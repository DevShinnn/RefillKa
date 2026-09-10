/**
 * Smoke tests for the modules that decide what users see and where they go.
 * Run: node --experimental-strip-types scripts/test-cases.mts
 */
import { logHref, opsHref, parseLogSearch, parseOpsTab } from '../lib/appNav.ts';
import { isDemoOfficer, isDemoViewer, mergeScopedRows, splitLiveData } from '../lib/demo.ts';
import { planPaidCount, planStart, fridayWeekStart, isInstallmentStore } from '../lib/installments.ts';
import { loginToEmail, normalizeOfficerId } from '../lib/loginId.ts';
import { isPendingOrder, isPastOrder, orderLineTotal, parseOrderPay, withDelivered } from '../lib/orders.ts';
import { canAccess, homeForRole, loginPathFor } from '../lib/roles.ts';

let failed = 0;
let passed = 0;

function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}

function ok(name: string, value: unknown) {
  if (value) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}`);
}

// --- Demo split ---
{
  const lgus = [
    { id: 'd', name: 'Demo sandbox' },
    { id: 't', name: 'Taguig' },
  ];
  const stores = [
    { id: 's1', lgu_id: 'd', store_code: 'DEMO-01', name: 'DEMO — Aling Rosa' },
    { id: 's2', lgu_id: 't', store_code: 'RK-01', name: 'Real Store' },
  ];
  const accounts = [
    { id: 'a1', officer_id: 'DEMO01', full_name: 'Demo CENRO' },
    { id: 'a2', officer_id: 'DEV01', full_name: 'Developer' },
  ];
  const payments = [
    { store_id: 's1', id: 'p1' },
    { store_id: 's2', id: 'p2' },
  ];
  const orders = [
    { store_id: 's1', id: 'o1' },
    { store_id: 's2', id: 'o2' },
  ];
  const storeNotes = [
    { id: 'n1', store_id: 's1' },
    { id: 'n2', store_id: 's2' },
  ];
  const appNotes = [
    { id: 'f1', logged_by: 'a1', logged_by_name: 'Demo CENRO' },
    { id: 'f2', logged_by: 'a2', logged_by_name: 'Developer' },
  ];
  const replies = [
    { id: 'r1', store_feedback_id: 'n1' },
    { id: 'r2', store_feedback_id: 'n2' },
  ];

  const real = splitLiveData({ officer_id: 'DEV01', full_name: 'Developer' }, {
    stores,
    accounts,
    lgus,
    payments,
    orders,
    storeNotes,
    appNotes,
    replies,
  });
  eq('real viewer keeps live store', real.stores.map((s) => s.id), ['s2']);
  eq('real viewer hides demo account', real.accounts.map((a) => a.officer_id), ['DEV01']);
  eq('real viewer hides Demo sandbox LGU', real.lgus.map((l) => l.name), ['Taguig']);
  eq('real viewer hides demo payment', real.payments.map((p) => p.id), ['p2']);
  eq('real viewer hides demo order', real.orders.map((o) => o.id), ['o2']);
  eq('real viewer hides demo store note', real.storeNotes.map((n) => n.id), ['n2']);
  eq('real viewer hides demo app note', real.appNotes.map((n) => n.id), ['f2']);
  eq('real viewer hides demo reply', real.replies.map((r) => r.id), ['r2']);

  const demo = splitLiveData({ officer_id: 'DEMO01', full_name: 'Demo CENRO' }, {
    stores,
    accounts,
    lgus,
    payments,
    orders,
    storeNotes,
    appNotes,
    replies,
  });
  eq('demo viewer keeps sandbox store', demo.stores.map((s) => s.id), ['s1']);
  eq('demo viewer keeps demo account', demo.accounts.map((a) => a.officer_id), ['DEMO01']);
  eq('demo viewer keeps Demo sandbox LGU', demo.lgus.map((l) => l.name), ['Demo sandbox']);
  eq('demo viewer keeps demo payment', demo.payments.map((p) => p.id), ['p1']);
  eq('demo viewer hides live order', demo.orders.map((o) => o.id), ['o1']);

  ok('isDemoOfficer DEMOADM', isDemoOfficer('DEMOADM'));
  ok('isDemoViewer by name', isDemoViewer({ full_name: 'Demo LGU Admin' }));
  ok('live officer is not demo', !isDemoOfficer('DEV01'));

  const merged = mergeScopedRows(
    [
      { id: 'hidden' },
      { id: 'visible' },
    ],
    [{ id: 'visible' }, { id: 'new' }],
    ['visible']
  );
  eq('mergeScopedRows keeps hidden rows', merged.map((r) => r.id).sort(), ['hidden', 'new', 'visible']);
}

// --- App navigation ---
{
  eq('log home href', logHref(), '/log');
  eq('log reorders href', logHref({ tab: 'reorders' }), '/log?tab=reorders');
  eq('log store href', logHref({ store: 'abc' }), '/log?store=abc');
  eq('log new href', logHref({ newStore: true }), '/log?new=1');
  eq('ops home href', opsHref(), '/ops');
  eq('ops stores href', opsHref('stores'), '/ops?tab=stores');

  eq('parse log default', parseLogSearch(new URLSearchParams()), {
    tab: 'stores',
    screen: 'list',
    storeId: null,
  });
  eq('parse log store', parseLogSearch(new URLSearchParams('store=abc')), {
    tab: 'stores',
    screen: 'store',
    storeId: 'abc',
  });
  eq('parse log new', parseLogSearch(new URLSearchParams('new=1')), {
    tab: 'stores',
    screen: 'new',
    storeId: null,
  });
  eq('parse log junk tab', parseLogSearch(new URLSearchParams('tab=hacked')), {
    tab: 'stores',
    screen: 'list',
    storeId: null,
  });
  eq('parse ops default', parseOpsTab(new URLSearchParams()), 'overview');
  eq('parse ops database', parseOpsTab(new URLSearchParams('tab=database')), 'database');
  eq('parse ops junk', parseOpsTab(new URLSearchParams('tab=nope')), 'overview');
}

// --- Login IDs ---
{
  eq('normalize officer id', normalizeOfficerId(' cenro01 '), 'CENRO01');
  eq('normalize letter-O in CENRO suffix', normalizeOfficerId('CENROO1'), 'CENRO01');
  eq('loginToEmail from id', loginToEmail('DEV01'), 'dev01@id.refillka.local');
  eq('loginToEmail from email', loginToEmail('Person@RefillKa.test'), 'person@refillka.test');
}

// --- Roles / session routing ---
{
  eq('cenro home', homeForRole('cenro'), '/log');
  eq('superadmin home', homeForRole('superadmin'), '/ops');
  eq('lgu admin home', homeForRole('lgu_admin'), '/admin');
  eq('exec home', homeForRole('lgu_exec'), '/executive');
  eq('login path for ops', loginPathFor('/ops'), '/ops');
  eq('login path for log', loginPathFor('/log'), '/login');
  eq('login path for admin', loginPathFor('/admin'), '/ops');
  ok('cenro can open /log', canAccess('cenro', '/log'));
  ok('cenro cannot open /ops', !canAccess('cenro', '/ops'));
  ok('superadmin can open /log', canAccess('superadmin', '/log'));
  ok('lgu_exec can open /executive', canAccess('lgu_exec', '/executive'));
  ok('unknown path is open', canAccess('cenro', '/login'));
}

// --- Orders ---
{
  eq('parse unpaid reorder', parseOrderPay('[Due 2026-09-12]'), {
    method: null,
    paidOn: null,
    dueOn: '2026-09-12',
    deliveredOn: null,
  });
  eq('parse paid delivered', parseOrderPay('[GCash] Paid 2026-09-11 · [Delivered 2026-09-12]'), {
    method: 'GCash',
    paidOn: '2026-09-11',
    dueOn: null,
    deliveredOn: '2026-09-12',
  });
  ok('pending reorder', isPendingOrder({ is_reorder: true, notes: '[Due 2026-09-12]' }));
  ok('delivered is past', isPastOrder({ is_reorder: true, notes: '[Delivered 2026-09-12]' }));
  ok('kit collection is not a pending reorder', !isPendingOrder({ is_reorder: false, notes: '' }));
  eq('line total', orderLineTotal({ unit_price: 25, quantity: 4 }), 100);
  ok('withDelivered tags once', withDelivered('note', '2026-09-11').includes('[Delivered 2026-09-11]'));
  eq('withDelivered is idempotent', withDelivered('[Delivered 2026-09-11]', '2026-09-12'), '[Delivered 2026-09-11]');
}

// --- Installments ---
{
  eq('Friday week start from Thursday', fridayWeekStart('2026-09-10'), '2026-09-04');
  eq('plan starts next Friday after claim', planStart('2026-09-11'), '2026-09-18');
  ok('installment store stays on plan', isInstallmentStore({ id: 's', pay_plan: 'installment' }, []));
  ok('fully paid store is not installment', !isInstallmentStore({ id: 's', pay_plan: 'fully_paid' }, []));
  eq(
    'nine kit tags complete the plan',
    planPaidCount(
      [
        '2026-09-11',
        '2026-09-18',
        '2026-09-25',
        '2026-10-02',
        '2026-10-09',
        '2026-10-16',
        '2026-10-23',
        '2026-10-30',
        '2026-11-06',
      ].map((week_start) => ({ store_id: 's', week_start, notes: 'Week collection' })),
      's'
    ),
    9
  );
  eq(
    'reorder notes do not count as kit tags',
    planPaidCount([{ store_id: 's', week_start: '2026-09-11', notes: 'Reorder' }], 's'),
    0
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
