import { useState, useMemo } from "react";
import useWorkspaceDb from "../../../hooks/useWorkspaceDb";
import {
  getWorkTypesInProject,
  countTasksByType,
  calculateTotalCost,
} from "../../../features/production-db/mutations/productionDbCalculations";

export default function CostAnalysisSection({ projectId, teamId, canEdit }) {
  const { db } = useWorkspaceDb();
  const [productionCosts, setProductionCosts] = useState(
    db.production_costs || []
  );
  const [editingCostId, setEditingCostId] = useState(null);
  const [priceInput, setPriceInput] = useState("");

  const workTypes = useMemo(() => {
    return getWorkTypesInProject(db.tasks, projectId, teamId);
  }, [db.tasks, projectId, teamId]);

  const costs = useMemo(() => {
    return workTypes.map((type) => {
      const existing = productionCosts.find(
        (c) =>
          c.project_id === projectId &&
          c.team_id === teamId &&
          c.part === type
      );

      const quantity = countTasksByType(db.tasks, projectId, teamId, type);
      const unitPrice = existing?.unit_price || 0;
      const totalCost = calculateTotalCost(unitPrice, quantity);

      return {
        id: existing?.id,
        type,
        unit_price: unitPrice,
        quantity,
        total_cost: totalCost,
      };
    });
  }, [db.tasks, productionCosts, projectId, teamId, workTypes]);

  const totalAmount = costs.reduce((sum, cost) => sum + cost.total_cost, 0);

  const handleEditPrice = (costId, type) => {
    const cost = costs.find((c) => c.type === type);
    setEditingCostId(costId || `new_${type}`);
    setPriceInput(String(cost?.unit_price || ""));
  };

  const handleSavePrice = (type) => {
    const numPrice = Number(priceInput);
    const existing = productionCosts.find(
      (c) =>
        c.project_id === projectId &&
        c.team_id === teamId &&
        c.part === type
    );

    let updatedCosts;
    if (existing) {
      updatedCosts = productionCosts.map((c) =>
        c.id === existing.id
          ? { ...c, unit_price: numPrice, updated_at: new Date().toISOString() }
          : c
      );
    } else {
      const newCost = {
        id: `cost_${projectId}_${teamId}_${type}_${Date.now()}`,
        project_id: projectId,
        team_id: teamId,
        part: type,
        unit_price: numPrice,
        quantity: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedCosts = [...productionCosts, newCost];
    }

    setProductionCosts(updatedCosts);
    setEditingCostId(null);
  };

  return (
    <div className="section-content">
      <div className="section-info">
        <span className="badge badge-auto">🔵 자동 수량</span>
        <span className="badge badge-manual">⚪ 수동 단가</span>
        {canEdit && <span className="badge badge-editable">✏️ 수정 가능</span>}
      </div>

      {costs.length === 0 ? (
        <div className="empty-section">
          <p>비용 항목이 없습니다</p>
        </div>
      ) : (
        <>
          <table className="section-table">
            <thead>
              <tr>
                <th>파트</th>
                <th className="auto">단가 (원)</th>
                <th className="auto">수량 (Task)</th>
                <th className="auto">총액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.type}>
                  <td className="col-type">{cost.type}</td>
                  <td className="col-price">
                    {editingCostId === cost.id || editingCostId === `new_${cost.type}` ? (
                      <div className="edit-inline">
                        <input
                          type="number"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          min="0"
                          placeholder="단가"
                        />
                        <button
                          onClick={() => handleSavePrice(cost.type)}
                          className="btn-save"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingCostId(null)}
                          className="btn-cancel"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="view-inline">
                        <span>{cost.unit_price.toLocaleString()}</span>
                        {canEdit && (
                          <button
                            onClick={() => handleEditPrice(cost.id, cost.type)}
                            className="btn-edit-small"
                          >
                            수정
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="col-count">{cost.quantity}</td>
                  <td className="col-total">{cost.total_cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-summary">
            <div className="summary-row">
              <span className="summary-label">전체 총액:</span>
              <span className="summary-value">{totalAmount.toLocaleString()} 원</span>
            </div>
          </div>
        </>
      )}

      <div className="section-note">
        <p>💡 단가는 수동으로 입력하고, 수량과 총액은 Task 데이터에서 자동 계산됩니다</p>
      </div>
    </div>
  );
}
