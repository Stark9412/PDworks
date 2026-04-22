import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";

export default function ReportExportSection({ projectId }) {
  const { db, writerName } = useWorkspaceDb();
  const [exportFormat, setExportFormat] = useState("html");
  const [showPreview, setShowPreview] = useState(false);

  const project = useMemo(
    () => db.projects?.find((p) => p.id === projectId),
    [db.projects, projectId]
  );

  const projectTasks = useMemo(
    () => (db.tasks || []).filter((t) => t.project_id === projectId),
    [db.tasks, projectId]
  );

  const projectCosts = useMemo(
    () => (db.production_costs || []).filter((c) => c.project_id === projectId),
    [db.production_costs, projectId]
  );

  const projectPlatforms = useMemo(
    () => (db.service_platforms || []).filter((p) => p.project_id === projectId),
    [db.service_platforms, projectId]
  );

  const projectPlannings = useMemo(
    () => (db.derivative_plannings || []).filter((p) => p.project_id === projectId),
    [db.derivative_plannings, projectId]
  );

  const projectEvaluations = useMemo(
    () => (db.writer_evaluations || []).filter((e) => e.project_id === projectId),
    [db.writer_evaluations, projectId]
  );

  const projectPdEvaluations = useMemo(
    () => (db.pd_evaluations || []).filter((e) => e.project_id === projectId),
    [db.pd_evaluations, projectId]
  );

  const projectHistory = useMemo(
    () => (db.change_histories || []).filter((h) => h.project_id === projectId),
    [db.change_histories, projectId]
  );

  const generateHtmlReport = () => {
    const now = new Date().toLocaleString("ko-KR");
    const totalCost = projectCosts.reduce(
      (sum, c) => sum + ((c.unit_price || 0) * (c.quantity || 0)),
      0
    );

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project?.title || "작품"} - 작품 DB 보고서</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif;
      color: #162740;
      line-height: 1.6;
    }
    @page { margin: 20mm; size: A4; }
    @media print {
      body { font-size: 11px; }
      .no-print { display: none; }
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #2f63c6;
      padding-bottom: 20px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { color: #617493; font-size: 12px; }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 16px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #dfe8f5;
      color: #2f63c6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
    }
    thead {
      background: #f5f7fa;
      border-bottom: 2px solid #dfe8f5;
    }
    th {
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: #3a567e;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #dfe8f5;
    }
    tr:hover { background: #fafbfc; }
    .summary-box {
      background: #f0f4fb;
      border-left: 3px solid #2f63c6;
      padding: 16px;
      border-radius: 6px;
      margin: 12px 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .summary-label { font-weight: 600; }
    .summary-value { font-family: monospace; color: #2f63c6; font-weight: 600; }
    .empty-message { color: #8899a8; font-size: 12px; font-style: italic; padding: 8px; }
    .action-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    button {
      padding: 10px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 120ms ease;
    }
    .btn-print {
      background: #2f63c6;
      color: white;
    }
    .btn-print:hover { background: #1f4494; }
    .btn-close {
      background: #f5f7fa;
      color: #617493;
    }
    .btn-close:hover { background: #eef2f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${project?.title || "작품"} - 작품 DB 보고서</h1>
      <p>생성일시: ${now}</p>
    </div>

    <div class="section">
      <h2>📋 기본 정보</h2>
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">작품명:</span>
          <span>${project?.title || "-"}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">프로젝트 ID:</span>
          <span>${projectId}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">작업(Task) 개수:</span>
          <span>${projectTasks.length}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">생성일:</span>
          <span>${project?.created_at ? new Date(project.created_at).toLocaleDateString("ko-KR") : "-"}</span>
        </div>
      </div>
    </div>

    ${
      projectCosts.length > 0
        ? `
    <div class="section">
      <h2>💰 제작 비용 분석</h2>
      <table>
        <thead>
          <tr>
            <th>파트</th>
            <th style="text-align: right">단가</th>
            <th style="text-align: right">개수</th>
            <th style="text-align: right">총액</th>
          </tr>
        </thead>
        <tbody>
          ${projectCosts
            .map((cost) => {
              const total = (cost.unit_price || 0) * (cost.quantity || 0);
              return `
            <tr>
              <td>${cost.part || "-"}</td>
              <td style="text-align: right; font-family: monospace">${(cost.unit_price || 0).toLocaleString()}원</td>
              <td style="text-align: right; font-family: monospace">${cost.quantity || 0}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600">${total.toLocaleString()}원</td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
      </table>
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">총 제작 비용:</span>
          <span class="summary-value">${totalCost.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    `
        : ""
    }

    ${
      projectPlatforms.length > 0
        ? `
    <div class="section">
      <h2>🌍 서비스 플랫폼</h2>
      <table>
        <thead>
          <tr>
            <th>플랫폼</th>
            <th>지역</th>
            <th>런칭일</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          ${projectPlatforms
            .map(
              (p) => `
            <tr>
              <td>${p.platform || "-"}</td>
              <td>${p.region || "-"}</td>
              <td>${p.launch_date || "-"}</td>
              <td>${p.status || "-"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    ${
      projectPlannings.length > 0
        ? `
    <div class="section">
      <h2>📦 파생 기획</h2>
      <table>
        <thead>
          <tr>
            <th>유형</th>
            <th>제목</th>
            <th>상태</th>
            <th>예정일</th>
            <th style="text-align: right">예산</th>
          </tr>
        </thead>
        <tbody>
          ${projectPlannings
            .map(
              (p) => `
            <tr>
              <td>${p.type || "-"}</td>
              <td>${p.title || "-"}</td>
              <td>${p.status || "-"}</td>
              <td>${p.planned_date || "-"}</td>
              <td style="text-align: right; font-family: monospace">${(p.budget || 0).toLocaleString()}원</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    ${
      projectHistory.length > 0
        ? `
    <div class="section">
      <h2>📋 변경 이력</h2>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>Task ID</th>
            <th>변경 내용</th>
            <th>변경자</th>
          </tr>
        </thead>
        <tbody>
          ${projectHistory
            .slice(-20)
            .reverse()
            .map(
              (h) => `
            <tr>
              <td>${h.changed_date || "-"}</td>
              <td style="font-family: monospace; font-size: 11px">${h.task_id || "-"}</td>
              <td>${h.change_type || "-"}: ${h.old_value || "-"} → ${h.new_value || "-"}</td>
              <td>${h.changed_by || "-"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    <div class="section no-print" style="border-top: 1px solid #dfe8f5; padding-top: 20px; text-align: center;">
      <div class="action-buttons" style="justify-content: center;">
        <button class="btn-print" onclick="window.print()">🖨️ 인쇄/PDF 저장</button>
        <button class="btn-close" onclick="window.close()">닫기</button>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  };

  const handleViewReport = () => {
    const html = generateHtmlReport();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, "_blank");
    if (newWindow) {
      newWindow.focus();
    }
  };

  const handleDownloadExcel = () => {
    // 간단한 CSV 다운로드 (xlsx 라이브러리 미사용)
    const headers = [
      "작품명",
      "파트",
      "단가",
      "개수",
      "총액",
      "플랫폼",
      "지역",
      "상태",
    ];
    const rows = projectCosts.map((cost) => [
      project?.title || "-",
      cost.part || "-",
      cost.unit_price || 0,
      cost.quantity || 0,
      (cost.unit_price || 0) * (cost.quantity || 0),
      "",
      "",
      "",
    ]);

    projectPlatforms.forEach((p) => {
      rows.push([
        project?.title || "-",
        "",
        "",
        "",
        "",
        p.platform || "-",
        p.region || "-",
        p.status || "-",
      ]);
    });

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${project?.title || "report"}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.click();
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-manual">⚪ 통합 조회</span>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 600 }}>
          보고서 생성 및 내보내기
        </h3>
        <p
          style={{
            fontSize: "12px",
            color: "#8899a8",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          작품 DB의 모든 정보를 보고서 형식으로 조회하거나 파일로 내보낼 수 있습니다.
        </p>

        <div className="action-buttons">
          <button
            onClick={handleViewReport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            className="btn-add"
          >
            📋 보고서 보기
          </button>
          <button
            onClick={handleDownloadExcel}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            className="btn-add"
          >
            📊 CSV 다운로드
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#f0f4fb",
          border: "1px solid #dfe8f5",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <h4 style={{ marginBottom: "12px", fontSize: "13px", fontWeight: 600 }}>
          📊 요약 통계
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              borderLeft: "3px solid #2f63c6",
            }}
          >
            <div style={{ fontSize: "11px", color: "#617493", marginBottom: 4 }}>
              총 작업(Task)
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#2f63c6" }}>
              {projectTasks.length}
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              borderLeft: "3px solid #2d8c58",
            }}
          >
            <div style={{ fontSize: "11px", color: "#617493", marginBottom: 4 }}>
              비용 파트
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#2d8c58" }}>
              {projectCosts.length}
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              borderLeft: "3px solid #c28c1f",
            }}
          >
            <div style={{ fontSize: "11px", color: "#617493", marginBottom: 4 }}>
              서비스 플랫폼
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#c28c1f" }}>
              {projectPlatforms.length}
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "12px",
              borderRadius: "6px",
              borderLeft: "3px solid #7a5412",
            }}
          >
            <div style={{ fontSize: "11px", color: "#617493", marginBottom: 4 }}>
              파생 기획
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#7a5412" }}>
              {projectPlannings.length}
            </div>
          </div>
        </div>
      </div>

      <div className="section-note">
        <p>
          💡 보고서 보기: 브라우저 인쇄 기능으로 PDF 저장 가능 | CSV
          다운로드: 스프레드시트 프로그램에서 편집 가능
        </p>
      </div>
    </div>
  );
}
