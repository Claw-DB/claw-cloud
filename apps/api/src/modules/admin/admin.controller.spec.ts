import { describe, expect, afterEach, it, vi } from 'vitest';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

describe('AdminController', () => {
  const adminService = {
    getOverview: vi.fn(),
    listWorkspaces: vi.fn(),
    listInstances: vi.fn(),
    listIncidents: vi.fn(),
    listPlatformFlags: vi.fn(),
  };
  const controller = new AdminController(adminService as unknown as AdminService);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates overview to service', async () => {
    adminService.getOverview.mockResolvedValueOnce({ totals: { workspaces: 1 }, health: {} });
    const response = await controller.overview();

    expect(response.totals.workspaces).toBe(1);
    expect(adminService.getOverview).toHaveBeenCalledOnce();
  });

  it('normalizes workspace query parameters', async () => {
    adminService.listWorkspaces.mockResolvedValueOnce({
      data: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 1,
    });

    const response = await controller.workspaces('acme', 'ACTIVE', 'PRO', 2, 10);

    expect(response.page).toBe(2);
    expect(adminService.listWorkspaces).toHaveBeenCalledWith({
      search: 'acme',
      status: 'ACTIVE',
      plan: 'PRO',
      page: 2,
      limit: 10,
    });
  });

  it('applies default incident limit', async () => {
    adminService.listIncidents.mockResolvedValueOnce({ data: [], counts: { warning: 0, critical: 0 } });

    await controller.incidents(undefined);

    expect(adminService.listIncidents).toHaveBeenCalledWith(50);
  });
});
