import { Suspense } from "react";
import KanbanPage from "./KanbanPageClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Carregando kanban…</div>}>
      <KanbanPage />
    </Suspense>
  );
}
