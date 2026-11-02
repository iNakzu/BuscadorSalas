const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

async function renderFor({ user, careerId, careerName, semesters }) {
  const container = { innerHTML: '', querySelector: () => null };
  const context = {
    window: {
      PortalAuth: { user: user ? { user_metadata: { career: careerName } } : null },
      PortalProfile: { getCareerId: () => careerId }
    },
    document: { getElementById: id => id === 'progreso-container' ? container : null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({ semestres: semesters }) }),
    console,
    navigator: {}
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('static/js/progreso.js', 'utf8'), context);
  await vm.runInContext('renderProgreso()', context);
  return container.innerHTML;
}

(async () => {
  const app = fs.readFileSync('static/js/app.js', 'utf8');
  assert.match(app, /panelId === 'tab-malla'.*panelId === 'tab-progreso'.*panelId === 'tab-solemnes'/s);
  assert.match(app, /mostrarAvisoAccesoMalla\(panelId\)/);

  const noLogin = await renderFor({ user: false, careerId: null, semesters: [] });
  assert.match(noLogin, /Inicia sesión para ver tu malla/);
  const noCareer = await renderFor({ user: true, careerId: null, semesters: [] });
  assert.match(noCareer, /Configura tu carrera/);
  const dataScience = await renderFor({
    user: true,
    careerId: 'ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial',
    careerName: 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial',
    semesters: []
  });
  assert.match(dataScience, /curriculum-unavailable-card/);
  assert.match(dataScience, /Esta malla todavía no está disponible/);
  assert.match(dataScience, /Ciencia de Datos/);

  const retryContainer = { innerHTML: '', querySelector: () => null };
  let curriculumRequests = 0;
  const retryContext = {
    window: {
      PortalAuth: { user: { user_metadata: { career: 'Ingeniería Civil Industrial' } } },
      PortalProfile: { getCareerId: () => 'ingenieria-civil-industrial' }
    },
    document: { getElementById: id => id === 'progreso-container' ? retryContainer : null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => {
      curriculumRequests += 1;
      if (curriculumRequests === 1) throw new Error('network unavailable');
      return { ok: true, json: async () => ({ semestres: [{ numero: 1, cursos: [{ id: 1, nombre: 'Curso de prueba' }] }] }) };
    },
    console,
    navigator: {}
  };
  retryContext.window.window = retryContext.window;
  vm.createContext(retryContext);
  vm.runInContext(fs.readFileSync('static/js/progreso.js', 'utf8'), retryContext);
  await vm.runInContext('renderProgreso()', retryContext);
  await vm.runInContext('renderProgreso()', retryContext);
  assert.strictEqual(curriculumRequests, 2, 'a failed curriculum request must be retried on the next render');
  assert.match(retryContainer.innerHTML, /Curso de prueba/);

  const community = fs.readFileSync('static/js/community_schedules.js', 'utf8');
  assert.match(community, /get_shared_profile_career/);
  const sql = fs.readFileSync('supabase/migrations/202610060001_shared_profile_career_for_solemnes.sql', 'utf8');
  for (const guard of ['p.share_information', 'public.is_community_member(auth.uid())', 'public.is_community_member(p.id)']) {
    assert(sql.includes(guard), `shared profile career RPC must retain ${guard}`);
  }
  assert.match(sql, /grant execute on function public\.get_shared_profile_career\(uuid\) to authenticated/);
  console.log('career gates: session and career required, Data Science unavailable state, shared-career privacy, and retry after a transient load failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
