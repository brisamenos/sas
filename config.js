// MicroCred — Configuração e variáveis globais
// Gerado automaticamente — edite apenas as credenciais

if (!navigator.locks) { navigator.locks = { request: (n,o,c) => { const f=typeof o==="function"?o:c; return Promise.resolve().then(()=>f({name:n})); }, query: ()=>Promise.resolve({held:[],pending:[]}) }; }

const SUPABASE_URL = 'https://iwuxqrjidsrsjwtbiycg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_bmsS5bUWDAQVxIp0ovQtow_gWMauzwd';

  let sb = null;
  let chartStatusInstance = null;
  let chartFinInstance = null;

  const EMPRESA_ID = sessionStorage.getItem('microcred_empresa_id');
  const EMPRESA_NOME = sessionStorage.getItem('microcred_empresa');
  const DEFAULT_LOGO = 'https://i.ibb.co/JwN1xd6y/image-2-removebg-preview.png';

  // Permissão de upload: true por default até carregar do DB
  let ALLOW_UPLOAD_IMAGENS = true;
