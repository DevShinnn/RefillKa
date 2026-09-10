/** Sandbox LGU + shared demo PIN. Testers never get superadmin. */
export const DEMO_LGU_NAME = 'Demo sandbox';
export const DEMO_PIN = '203047';

export const DEMO_FIELD = {
  officerId: 'DEMO01',
  name: 'Demo CENRO',
  role: 'cenro' as const,
};

export const DEMO_OPS = {
  officerId: 'DEMOADM',
  name: 'Demo LGU Admin',
  role: 'lgu_admin' as const,
};
