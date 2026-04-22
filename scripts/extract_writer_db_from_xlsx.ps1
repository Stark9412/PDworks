param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Normalize-CellText {
  param([AllowNull()][object]$Value)

  if ($null -eq $Value) { return $null }

  $text = [string]$Value
  $text = $text -replace '\s+', ' '
  $text = $text.Trim()

  if ($text -in @('', '-', '--', 'N/A', 'n/a', 'none')) {
    return $null
  }

  return $text
}

function Join-Unique {
  param([string[]]$Values)

  $filtered = @($Values | Where-Object { $_ } | Select-Object -Unique)
  if ($filtered.Count -eq 0) { return $null }
  return ($filtered -join '; ')
}

function Get-SingleOrNull {
  param([string[]]$Values)

  $filtered = @($Values | Where-Object { $_ } | Select-Object -Unique)
  if ($filtered.Count -eq 1) { return $filtered[0] }
  return $null
}

function Normalize-EmploymentType {
  param([AllowNull()][string]$Value)

  return (Normalize-CellText $Value)
}

function Normalize-Phone {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return $null }

  $digits = ($text -replace '[^0-9]', '')
  if (-not $digits) { return $null }

  return $digits
}

function Normalize-Email {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return $null }
  if ($text -notmatch '@') { return $null }

  return $text.ToLowerInvariant()
}

function Normalize-Grade {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return $null }

  return $text.ToUpperInvariant()
}

function Normalize-DecimalString {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return $null }

  [decimal]$number = 0
  if ([decimal]::TryParse($text, [ref]$number)) {
    return [string]$number
  }

  return $null
}

function Normalize-FeeLabel {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return $null }

  [decimal]$number = 0
  if ([decimal]::TryParse($text, [ref]$number)) {
    return ('{0:0}' -f $number) + ' KRW'
  }

  return $text
}

function Normalize-WorkTypes {
  param([AllowNull()][string]$Value)

  $text = Normalize-CellText $Value
  if (-not $text) { return @() }

  return @($text -split '\s*/\s*|\s*,\s*' | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
}

function Read-XlsxSheetRows {
  param([string]$Path)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)

  function Get-EntryText {
    param([string]$EntryName)

    $entry = $zip.Entries | Where-Object { $_.FullName -eq $EntryName } | Select-Object -First 1
    if (-not $entry) { return $null }

    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    try {
      return $reader.ReadToEnd()
    }
    finally {
      $reader.Dispose()
      $stream.Dispose()
    }
  }

  try {
    $sharedStrings = @()
    $sharedXmlText = Get-EntryText 'xl/sharedStrings.xml'
    if ($sharedXmlText) {
      [xml]$sharedXml = $sharedXmlText
      foreach ($item in $sharedXml.sst.si) {
        $sharedStrings += $item.InnerText
      }
    }

    [xml]$workbookXml = Get-EntryText 'xl/workbook.xml'
    [xml]$relsXml = Get-EntryText 'xl/_rels/workbook.xml.rels'

    $relMap = @{}
    foreach ($rel in $relsXml.Relationships.Relationship) {
      $relMap[[string]$rel.Id] = [string]$rel.Target
    }

    $ns = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
    $ns.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $sheetNode = $workbookXml.SelectSingleNode('//x:sheets/x:sheet', $ns)
    if (-not $sheetNode) { throw 'No worksheet found in workbook.' }

    $rid = $sheetNode.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $target = $relMap[$rid]
    if (-not $target) { throw 'Worksheet relationship target not found.' }

    $sheetPath = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { 'xl/' + $target.TrimStart('./') }
    [xml]$sheetXml = Get-EntryText $sheetPath

    $sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $sheetNs.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $rowNodes = $sheetXml.SelectNodes('//x:sheetData/x:row', $sheetNs)

    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($rowNode in $rowNodes) {
      $cellMap = @{}
      foreach ($cell in $rowNode.c) {
        $ref = [string]$cell.r
        $column = $ref -replace '\d', ''
        $cellType = [string]$cell.GetAttribute('t')
        $value = $null
        $valueNode = $cell.SelectSingleNode('x:v', $sheetNs)

        if ($cellType -eq 'inlineStr') {
          $value = $cell.InnerText
        }
        elseif ($valueNode) {
          $rawValue = [string]$valueNode.InnerText
          if ($cellType -eq 's') {
            $index = [int]$rawValue
            if ($index -lt $sharedStrings.Count) {
              $value = $sharedStrings[$index]
            }
            else {
              $value = $rawValue
            }
          }
          else {
            $value = $rawValue
          }
        }

        $cellMap[$column] = $value
      }

      $rows.Add([pscustomobject]@{
        RowNumber = [int]$rowNode.r
        Cells = $cellMap
      })
    }

    return $rows
  }
  finally {
    $zip.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Input file not found: $InputPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$rows = Read-XlsxSheetRows -Path $InputPath
if ($rows.Count -lt 2) {
  throw 'Worksheet does not contain data rows.'
}

$dataRows = @()
foreach ($row in ($rows | Where-Object { $_.RowNumber -ge 2 })) {
  $cells = $row.Cells
  $writerName = Normalize-CellText $cells['F']
  if (-not $writerName) { continue }

  $workTypes = Normalize-WorkTypes $cells['E']
  $employmentRaw = Normalize-CellText $cells['G']
  $phone = Normalize-Phone $cells['N']
  $email = Normalize-Email $cells['O']
  $feeLabel = Normalize-FeeLabel $cells['H']
  $rsRatio = Normalize-DecimalString $cells['I']

  $dataRows += [pscustomobject]@{
    source_row = $row.RowNumber
    project_title = Normalize-CellText $cells['B']
    genre = Normalize-CellText $cells['C']
    active_period = Normalize-CellText $cells['D']
    work_type_raw = Normalize-CellText $cells['E']
    work_types_normalized = ($workTypes -join '; ')
    writer_name = $writerName
    employment_type_raw = $employmentRaw
    employment_type_normalized = Normalize-EmploymentType $employmentRaw
    fee_raw = Normalize-CellText $cells['H']
    fee_normalized = $feeLabel
    rs_raw = Normalize-CellText $cells['I']
    rs_normalized = $rsRatio
    overall_grade = Normalize-Grade $cells['J']
    work_grade = Normalize-Grade $cells['K']
    deadline_grade = Normalize-Grade $cells['L']
    communication_grade = Normalize-Grade $cells['M']
    phone_normalized = $phone
    email_normalized = $email
    evaluator = Normalize-CellText $cells['P']
    remark = Normalize-CellText $cells['Q']
    contract_link = Normalize-CellText $cells['R']
  }
}

$writerRows = foreach ($group in ($dataRows | Group-Object writer_name | Sort-Object Name)) {
  $items = @($group.Group)
  $employmentValues = @($items.employment_type_normalized | Where-Object { $_ } | Select-Object -Unique)
  $feeValues = @($items.fee_normalized | Where-Object { $_ } | Select-Object -Unique)
  $rsValues = @($items.rs_normalized | Where-Object { $_ } | Select-Object -Unique)
  $phoneValues = @($items.phone_normalized | Where-Object { $_ } | Select-Object -Unique)
  $emailValues = @($items.email_normalized | Where-Object { $_ } | Select-Object -Unique)
  $linkValues = @($items.contract_link | Where-Object { $_ } | Select-Object -Unique)
  $workTypeValues = @($items.work_types_normalized | Where-Object { $_ } | ForEach-Object { $_ -split '; ' } | Where-Object { $_ } | Select-Object -Unique)
  $genreValues = @($items.genre | Where-Object { $_ } | Select-Object -Unique)

  $reviewNotes = New-Object System.Collections.Generic.List[string]
  if ($employmentValues.Count -gt 1) { $reviewNotes.Add('employment_type conflict') }
  if ($feeValues.Count -gt 1) { $reviewNotes.Add('fee_label conflict') }
  if ($rsValues.Count -gt 1) { $reviewNotes.Add('rs_ratio conflict') }
  if ($phoneValues.Count -gt 1) { $reviewNotes.Add('multiple phones') }
  if ($emailValues.Count -gt 1) { $reviewNotes.Add('multiple emails') }
  if ($linkValues.Count -gt 1) { $reviewNotes.Add('multiple contract links') }

  $legacyLines = @(
    'source_rows=' + (Join-Unique ($items.source_row | ForEach-Object { [string]$_ })),
    'projects=' + (Join-Unique $items.project_title),
    'periods=' + (Join-Unique $items.active_period),
    'evaluators=' + (Join-Unique $items.evaluator),
    'remarks=' + (Join-Unique $items.remark)
  ) | Where-Object { $_ -notmatch '=$' }

  [pscustomobject]@{
    source_rows = Join-Unique ($items.source_row | ForEach-Object { [string]$_ })
    writer_name = $group.Name
    project_titles = Join-Unique $items.project_title
    genres = Join-Unique $items.genre
    active_periods = Join-Unique $items.active_period
    work_type_raw_list = Join-Unique $items.work_type_raw
    work_types_normalized = Join-Unique $workTypeValues
    employment_type_raw_list = Join-Unique $items.employment_type_raw
    employment_type_normalized = Get-SingleOrNull $employmentValues
    fee_raw_list = Join-Unique $items.fee_raw
    representative_fee_label = Get-SingleOrNull $feeValues
    rs_raw_list = Join-Unique $items.rs_raw
    representative_rs_ratio = Get-SingleOrNull $rsValues
    overall_grade = Get-SingleOrNull ($items.overall_grade | Where-Object { $_ })
    work_grade = Get-SingleOrNull ($items.work_grade | Where-Object { $_ })
    deadline_grade = Get-SingleOrNull ($items.deadline_grade | Where-Object { $_ })
    communication_grade = Get-SingleOrNull ($items.communication_grade | Where-Object { $_ })
    phone_list = Join-Unique $phoneValues
    representative_phone = Get-SingleOrNull $phoneValues
    email_list = Join-Unique $emailValues
    representative_email = Get-SingleOrNull $emailValues
    evaluator_list = Join-Unique $items.evaluator
    remark_summary = Join-Unique $items.remark
    contract_link_list = Join-Unique $linkValues
    supabase_legal_name = $group.Name
    supabase_primary_pen_name = $null
    supabase_employment_type_candidate_raw = Get-SingleOrNull $employmentValues
    supabase_main_work_types_candidate_raw = Join-Unique $workTypeValues
    supabase_primary_genres = Join-Unique $genreValues
    supabase_fee_label = if ($feeValues.Count -eq 1) { $feeValues[0] } else { $null }
    supabase_rs_ratio = if ($rsValues.Count -eq 1) { $rsValues[0] } else { $null }
    supabase_contract_link = Get-SingleOrNull $linkValues
    supabase_legacy_note = ($legacyLines -join ' | ')
    review_status = if ($reviewNotes.Count -gt 0) { 'REVIEW_NEEDED' } else { 'READY' }
    review_note = Join-Unique $reviewNotes
  }
}

$reviewNeededCount = @($writerRows | Where-Object { $_.review_status -eq 'REVIEW_NEEDED' }).Count
$readyCount = @($writerRows | Where-Object { $_.review_status -eq 'READY' }).Count
$rowCount = $dataRows.Count
$writerCount = $writerRows.Count

$summaryLines = @(
  '# Writer DB First Pass',
  '',
  "Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
  ('Source file: ' + $InputPath),
  '',
  '## Scope',
  '- This pass prepares writer master data for Supabase before any direct insert.',
  '- Target tables for the first load are `public.writers` and `public.writer_contacts`.',
  '- `public.writer_aliases` is left empty in this pass because the workbook does not provide a stable pen-name/legal-name split.',
  '- Project participation and contract rows should be handled in a later pass after project title matching is reviewed.',
  '',
  '## Counts',
  ('- Source rows with writer name: ' + $rowCount),
  ('- Unique writers after grouping by writer name: ' + $writerCount),
  ('- Writers marked READY: ' + $readyCount),
  ('- Writers marked REVIEW_NEEDED: ' + $reviewNeededCount),
  '',
  '## Mapping decisions',
  '- `writer_name` -> `writers.legal_name`',
  '- `employment_type` is preserved as a raw candidate in this pass and should be mapped to canonical insert values later.',
  '- Grade columns -> `writers.overall_grade`, `writers.work_grade`, `writers.deadline_grade`, `writers.communication_grade`',
  '- `work_type_raw` is preserved as raw grouped tokens in this pass and should be mapped to canonical insert values later.',
  '- `genre` -> `writers.primary_genres`',
  '- `fee_raw` -> `writers.fee_label` only when the grouped writer has a single consistent value',
  '- `rs_raw` -> `writers.rs_ratio` only when the grouped writer has a single consistent value',
  '- `phone_normalized`, `email_normalized` -> candidate rows for `writer_contacts`',
  '- Workbook remarks and source trace -> `writers.legacy_note`',
  '',
  '## Review rules',
  '- A writer is marked REVIEW_NEEDED when grouped rows disagree on employment type, fee label, RS ratio, phone, email, or contract link.',
  '- Numeric fees are converted to KRW labels for review, not to structured contract terms.',
  '- Empty or placeholder values such as `-` are dropped.',
  ''
)

$rawCsvPath = Join-Path $OutputDir 'writer_rows_first_pass.csv'
$writerCsvPath = Join-Path $OutputDir 'writer_summary_first_pass.csv'
$summaryPath = Join-Path $OutputDir 'writer_import_first_pass.md'

$dataRows | Export-Csv -LiteralPath $rawCsvPath -NoTypeInformation -Encoding UTF8
$writerRows | Export-Csv -LiteralPath $writerCsvPath -NoTypeInformation -Encoding UTF8
[System.IO.File]::WriteAllLines($summaryPath, $summaryLines, [System.Text.Encoding]::UTF8)

[pscustomobject]@{
  raw_csv = $rawCsvPath
  writer_csv = $writerCsvPath
  summary_md = $summaryPath
  source_rows = $rowCount
  unique_writers = $writerCount
  ready_writers = $readyCount
  review_writers = $reviewNeededCount
} | ConvertTo-Json
