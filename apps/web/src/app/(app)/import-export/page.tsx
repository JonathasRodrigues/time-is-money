export const dynamic = 'force-dynamic';

import { ImportExportClient } from '@/components/import-export-client';
import { PageHeader } from '@/components/page-header';

export default function ImportExportPage(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importação / Exportação"
        description="CSV e XLSX com template oficial, mapeamento automático e preview."
      />
      <ImportExportClient />
    </div>
  );
}
