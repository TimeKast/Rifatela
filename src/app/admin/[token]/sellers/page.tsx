/**
 * Admin Sellers Management Page — SCR-005 / RIF-013
 *
 * RSC entry point. Lists active + archived sellers (toggled via URL
 * searchParam `?archived=true`) and binds the 3 seller server actions
 * (RIF-014) with the admin token before handing them to the client
 * component. The form/list interactions live in `<SellersManagement>`.
 *
 * Access gated by middleware (RIF-007) against ADMIN_ACCESS_TOKEN.
 *
 * @see project/planning/15_DESIGN.md SCR-005
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-013-admin-sellers-management.md
 */

import { SellersManagement } from '@/components/sellers/SellersManagement';
import { archiveSeller, createSeller, rotateSellerToken } from '@/lib/actions/sellers';
import { listSellers } from '@/lib/sellers/list-sellers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ archived?: string }>;
}

export default async function AdminSellersPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { archived } = await searchParams;
  const showArchived = archived === 'true';

  // Active list is always fetched. Archived only when toggle is on, so we
  // don't pay the second query cost on the default view.
  const activeSellers = await listSellers({ includeArchived: false });
  const archivedSellers = showArchived ? await listSellers({ includeArchived: true }) : [];

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <SellersManagement
      token={token}
      origin={origin}
      activeSellers={activeSellers}
      archivedSellers={archivedSellers}
      showArchived={showArchived}
      createAction={createSeller.bind(null, token)}
      rotateAction={rotateSellerToken.bind(null, token)}
      archiveAction={archiveSeller.bind(null, token)}
    />
  );
}
