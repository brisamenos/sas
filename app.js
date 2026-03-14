// MicroCred — Lógica principal do sistema
// Depende de: config.js, Supabase SDK, Chart.js, SheetJS

async function initApp() {
    if (!SUPABASE_URL || SUPABASE_URL === 'SUA_URL_AQUI') {
      document.getElementById('appShell').innerHTML = '<div style="max-width:480px;margin:80px auto;text-align:center;padding:20px;"><h2>Credenciais não configuradas</h2></div>';
      return;
    }
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    
    if (sessionStorage.getItem('microcred_auth') !== 'true' || !EMPRESA_ID) {
      window.location.href = 'login.html'; 
      return;
    }

    const emailDisplay = document.getElementById('userEmailDisplay');
    const userChip = document.getElementById('userChip');
    const userAvatar = document.getElementById('userAvatar');
    if (emailDisplay && EMPRESA_NOME) {
        emailDisplay.textContent = EMPRESA_NOME;
        if (userAvatar) userAvatar.textContent = EMPRESA_NOME.charAt(0).toUpperCase();
        if (userChip) userChip.style.display = 'flex';
    }
    // Relógio em tempo real
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2,'0');
      const m = String(now.getMinutes()).padStart(2,'0');
      const s = String(now.getSeconds()).padStart(2,'0');
      const el = document.getElementById('clockTime');
      if (el) el.textContent = h + ':' + m + ':' + s;
      const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const elD = document.getElementById('clockDate');
      if (elD) elD.textContent = dias[now.getDay()] + ', ' + now.getDate() + ' ' + meses[now.getMonth()] + ' ' + now.getFullYear();
    }
    updateClock();
    setInterval(updateClock, 1000);

    const userLogo = sessionStorage.getItem('microcred_logo');
    if(userLogo && userLogo !== 'null') {
      document.getElementById('sidebarLogo').src = userLogo;
    } else {
      document.getElementById('sidebarLogo').src = DEFAULT_LOGO;
    }

    navigate('dashboard');

    // Buscar permissões (sem bloquear o app se coluna não existir ainda)
    try {
      const { data } = await sb.from('usuarios_clientes').select('*').eq('id', EMPRESA_ID).single();
      if (data) {
        ALLOW_UPLOAD_IMAGENS = data.allow_upload_imagens !== false;
        if (data.usuario) sessionStorage.setItem('microcred_usuario', data.usuario);
      }
    } catch (_) { /* coluna pode não existir ainda — ignora silenciosamente */ }
  }

  function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }

  // =============================================
  // NAVIGATION & MOBILE FIX
  // =============================================
  const pageTitles = {
    dashboard: 'Dashboard', tarefas: 'Tarefas', clientes: 'Clientes & Avalistas', avalistas: 'Clientes & Avalistas', negocios: 'Micro Negócios',
    avaliacao: 'Leads', fluxo: 'Fluxo de Caixa', operacoes: 'Operações',
    parcelas: 'Parcelas', inadimplencia: 'Inadimplência', renovacoes: 'Renovações', relatorios: 'Relatórios',
    plano: 'Meu Perfil'
  };

  function navigate(page) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (nav) nav.classList.add('active');
    
    document.getElementById('pageTitle').textContent = pageTitles[page] || page;
    
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlayBg').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (page) {
      case 'dashboard': loadDashboard(); break;
      case 'clientes': loadClientes(); break;
      case 'avalistas': navigate('clientes'); return;
      case 'negocios': loadNegocios(); break;
      case 'avaliacao': loadLeads(); break;
      case 'fluxo': loadFluxos(); break;
      case 'operacoes': loadOperacoes(); break;
      case 'parcelas': loadParcelas(); break; 
      case 'inadimplencia': 
          document.getElementById('tblInadimplencia').innerHTML = '<tr><td colspan="6" class="empty-state">A carregar...</td></tr>';
          loadInadimplencia(); 
          break;
      case 'renovacoes': loadRenovacoes(); break;
      case 'relatorios': loadRelatorios(); break;
      case 'tarefas': loadTarefas(); break;
      case 'plano': loadPlano(); break;
    }
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlayBg').classList.toggle('open');
  }

  // =============================================
  // UTILITIES & MASKS
  // =============================================
  function fmt(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'; }
  function showToast(msg, type = 'info') {
    const icons = {
      success: '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
      error:   '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>',
      info:    '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      warning: '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    };
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
    c.appendChild(t); setTimeout(() => t.remove(), 3800);
  }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  
  function maskCPF(el) {
    let v = el.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    el.value = v;
  }

  function maskMoney(el) {
    let v = el.value.replace(/\D/g, '');
    if (v === '') { el.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    el.value = v;
  }

  function unmaskMoney(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
  }

  function toMoneyInput(num) {
    if (!num && num !== 0) return '';
    let v = Number(num).toFixed(2);
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return v;
  }

  function statusBadge(s) {
    const map = {
      ativo: 'success', inativo: 'neutral', bloqueado: 'danger',
      em_analise: 'info', aprovada: 'success', liberada: 'info',
      em_andamento: 'warning', quitada: 'success', inadimplente: 'danger',
      pendente: 'warning', paga: 'success', atrasada: 'danger', resolvido: 'success',
    };
    const label = (s || '').replace(/_/g, ' ');
    return `<span class="badge badge-${map[s] || 'neutral'}">${label.charAt(0).toUpperCase() + label.slice(1)}</span>`;
  }

  async function uploadFileToSupabase(file, folderName) {
    if (!file) return null;
    // Bloquear upload de imagens de clientes/avalistas se a permissão estiver desativada
    if (!ALLOW_UPLOAD_IMAGENS && (folderName === 'clientes' || folderName === 'avalistas')) {
      showToastUpgradePro();
      throw new Error('Upload de imagens bloqueado. Faça upgrade para o plano PRO.');
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${folderName}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const { error } = await sb.storage.from('imagens').upload(fileName, file);
    if (error) throw new Error(error.message);
    return sb.storage.from('imagens').getPublicUrl(fileName).data.publicUrl;
  }

  function showToastUpgradePro() {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast warning';
    t.style.cssText = 'max-width:340px;padding:14px 18px 14px 14px;gap:12px;align-items:flex-start;';
    t.innerHTML = `
      <svg style="width:22px;height:22px;flex-shrink:0;margin-top:1px;" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <div>
        <div style="font-weight:700;font-size:13.5px;margin-bottom:3px;">Funcionalidade bloqueada</div>
        <div style="font-size:12px;opacity:0.9;line-height:1.5;">O upload de imagens está desativado no seu plano atual. <strong>Faça upgrade para o Plano PRO</strong> para liberar esta função.</div>
      </div>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  }

  // Aplica overlay visual de bloqueio nos campos de upload de imagem
  function aplicarBloqueioUpload() {
    const uploadIds = ['cFotoAtiv','cFotoAtivCamera','cDocFrente','cDocFrenteCamera','cDocVerso','cDocVersoCamera','aFoto'];
    const bannerIds = ['uploadBlockBannerCliente','uploadBlockBannerAvalista'];

    uploadIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!ALLOW_UPLOAD_IMAGENS) {
        el.disabled = true;
        el.style.opacity = '0.4';
        el.style.cursor = 'not-allowed';
        el.onclick = (e) => { e.preventDefault(); showToastUpgradePro(); };
      } else {
        el.disabled = false;
        el.style.opacity = '';
        el.style.cursor = '';
        el.onclick = null;
      }
    });

    bannerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = ALLOW_UPLOAD_IMAGENS ? 'none' : 'flex';
    });
  }

  function mudarTipoCadastro(tipo, silencioso) {
    document.getElementById('cTipoRegistro').value = tipo;
    const isAv = tipo === 'avalista';

    // Botões visuais
    const btnC = document.getElementById('btnTipoCliente');
    const btnA = document.getElementById('btnTipoAvalista');
    if (btnC) {
      if (isAv) {
        btnC.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius-sm);border:2px solid var(--border);background:var(--surface-2);color:var(--text-secondary);font-weight:700;font-size:13px;font-family:\'Outfit\',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;';
        btnA.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius-sm);border:2px solid var(--info);background:linear-gradient(135deg,#1565c0,#2979ff);color:#fff;font-weight:700;font-size:13px;font-family:\'Outfit\',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;';
      } else {
        btnC.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius-sm);border:2px solid var(--primary);background:linear-gradient(135deg,#ff5722,#ff7043);color:#fff;font-weight:700;font-size:13px;font-family:\'Outfit\',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;';
        btnA.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius-sm);border:2px solid var(--border);background:var(--surface-2);color:var(--text-secondary);font-weight:700;font-size:13px;font-family:\'Outfit\',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;';
      }
    }

    // Mostrar/ocultar secção de avalista
    const secAv = document.getElementById('secaoAvalista');
    if (secAv) secAv.style.display = isAv ? 'block' : 'none';

    // Ocultar secção de GPS e "Avalista do Cliente" quando for avalista
    const secGPS = document.getElementById('secaoGPS');
    if (secGPS) secGPS.style.display = isAv ? 'none' : '';
    const secAvDoCli = document.getElementById('secaoAvalistaDoCliente');
    if (secAvDoCli) secAvDoCli.style.display = isAv ? 'none' : '';

    // Atualizar título do modal se já aberto
    if (!silencioso) {
      document.getElementById('modalClienteTitle').textContent = isAv ? 'Novo Avalista' : 'Novo Cliente';
      // Carregar lista de clientes para o select de avalista
      if (isAv) loadClienteOptions('avClienteRelacionado', '');
    }
  }

  function capturarLocalizacao() {
    const btn = document.getElementById('btnGps');
    const status = document.getElementById('gpsStatus');
    if (!navigator.geolocation) {
      status.textContent = 'GPS não suportado neste dispositivo.';
      status.style.color = 'var(--danger)';
      return;
    }
    btn.textContent = 'Obtendo...';
    btn.disabled = true;
    status.textContent = 'Aguardando permissão de localização...';
    status.style.color = 'var(--text-light)';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById('cLatitude').value = lat;
        document.getElementById('cLongitude').value = lng;
        document.getElementById('cLatLng').value = `${lat}, ${lng}`;
        
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const btnMapa = document.getElementById('btnAbrirMapa');
        btnMapa.href = mapUrl;
        btnMapa.style.display = 'inline-flex';
        
        status.textContent = `✓ Localização capturada com precisão de ~${Math.round(pos.coords.accuracy)}m`;
        status.style.color = 'var(--success-text)';
        btn.innerHTML = '<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Atualizar';
        btn.disabled = false;
      },
      (err) => {
        const msgs = { 1: 'Permissão negada pelo usuário.', 2: 'Posição indisponível.', 3: 'Tempo esgotado.' };
        status.textContent = '✗ ' + (msgs[err.code] || 'Erro ao obter localização.');
        status.style.color = 'var(--danger)';
        btn.innerHTML = '<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Tentar Novamente';
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function loadClienteOptions(selectId, selectedId) {
    const { data } = await sb.from('clientes').select('id,nome').eq('empresa_id', EMPRESA_ID).order('nome');
    document.getElementById(selectId).innerHTML = '<option value="">Selecione um cliente</option>' + (data || []).map(c =>
      `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.nome}</option>`
    ).join('');
  }

  async function loadNegocioOptions(selectId, selectedId) {
    const { data } = await sb.from('micro_negocios').select('id,nome_fantasia').eq('empresa_id', EMPRESA_ID);
    document.getElementById(selectId).innerHTML = '<option value="">Selecione</option>' + (data || []).map(n =>
      `<option value="${n.id}" ${n.id === selectedId ? 'selected' : ''}>${n.nome_fantasia || 'Sem nome'}</option>`
    ).join('');
  }

  // =============================================
  // MEU PLANO E CONFIGURAÇÃO DA LOGO
  // =============================================
  function loadPlano() {
    const venc = sessionStorage.getItem('microcred_vencimento');
    if (venc) {
      const dateObj = new Date(venc + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const diffTime = dateObj - hoje;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      document.getElementById('planoDataVenc').textContent = dateObj.toLocaleDateString('pt-BR');
      const diasEl = document.getElementById('planoDiasRestantes');
      
      if (diffDays < 0) {
          diasEl.textContent = 'Expirado'; diasEl.style.color = 'var(--danger)';
      } else if (diffDays <= 7) {
          diasEl.textContent = diffDays + ' dias (Vence em breve!)'; diasEl.style.color = 'var(--danger)';
      } else {
          diasEl.textContent = diffDays + ' dias'; diasEl.style.color = 'var(--success-text)';
      }
    }
    const currentLogo = sessionStorage.getItem('microcred_logo');
    document.getElementById('previewLogoPlano').src = (currentLogo && currentLogo !== 'null') ? currentLogo : DEFAULT_LOGO;

    // Pre-fill profile fields
    document.getElementById('perfilNome').value    = sessionStorage.getItem('microcred_empresa') || '';
    document.getElementById('perfilUsuario').value = sessionStorage.getItem('microcred_usuario') || '';
    document.getElementById('perfilSenha').value   = '';
    // Totais backup
    Promise.all([sb.from('clientes').select('id',{count:'exact',head:true}).eq('empresa_id',EMPRESA_ID),sb.from('operacoes').select('id',{count:'exact',head:true}).eq('empresa_id',EMPRESA_ID),sb.from('parcelas').select('id',{count:'exact',head:true}).eq('empresa_id',EMPRESA_ID),sb.from('inadimplencia').select('id',{count:'exact',head:true}).eq('empresa_id',EMPRESA_ID)]).then(([rC,rO,rP,rI])=>{const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??0;};s('bkTotalClientes',rC.count);s('bkTotalOps',rO.count);s('bkTotalParc',rP.count);s('bkTotalInad',rI.count);}).catch(()=>{});
    document.getElementById('perfilSenhaConf').value = '';
  }

  async function salvarPerfil() {
    const nome      = document.getElementById('perfilNome').value.trim();
    const usuario   = document.getElementById('perfilUsuario').value.trim();
    const senha     = document.getElementById('perfilSenha').value;
    const senhaConf = document.getElementById('perfilSenhaConf').value;
    const btn = document.getElementById('btnSalvarPerfil');

    if (!nome) return showToast('Nome é obrigatório.', 'warning');
    if (senha && senha !== senhaConf) return showToast('As senhas não coincidem.', 'error');

    btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
      // Tenta atualizar com usuario; se coluna não existir, tenta só nome_empresa
      const upd = { nome_empresa: nome };
      if (usuario) upd.usuario = usuario;
      if (senha)   upd.senha   = senha;

      const { error } = await sb.from('usuarios_clientes').update(upd).eq('id', EMPRESA_ID);
      if (error) {
        // Fallback: só atualiza nome e senha (ignora usuario se coluna não existe)
        const updMin = { nome_empresa: nome };
        if (senha) updMin.senha = senha;
        const { error: e2 } = await sb.from('usuarios_clientes').update(updMin).eq('id', EMPRESA_ID);
        if (e2) throw e2;
      }

      sessionStorage.setItem('microcred_empresa', nome);
      if (usuario) sessionStorage.setItem('microcred_usuario', usuario);

      const emailDisplay = document.getElementById('userEmailDisplay');
      const userAvatar   = document.getElementById('userAvatar');
      if (emailDisplay) emailDisplay.textContent = nome;
      if (userAvatar)   userAvatar.textContent   = nome.charAt(0).toUpperCase();

      document.getElementById('perfilSenha').value    = '';
      document.getElementById('perfilSenhaConf').value = '';
      showToast('Perfil atualizado com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      btn.textContent = 'Salvar Alterações'; btn.disabled = false;
    }
  }

  function handleLogoClick() {
    const currentLogo = sessionStorage.getItem('microcred_logo');
    if (currentLogo && currentLogo !== DEFAULT_LOGO && currentLogo !== 'null') openModal('modalConfirmDeleteLogo');
    else openLogoSelector();
  }

  function openLogoSelector() { closeModal('modalConfirmDeleteLogo'); document.getElementById('uploadLogoPlano').click(); }

  async function confirmDeleteLogo() {
    closeModal('modalConfirmDeleteLogo');
    try {
      showToast('A excluir logótipo...', 'info');
      const { data: currentData } = await sb.from('usuarios_clientes').select('logo_url').eq('id', EMPRESA_ID).single();
      if (currentData && currentData.logo_url && currentData.logo_url.includes('/storage/v1/object/public/imagens/logos/')) {
          const filePath = currentData.logo_url.split('/public/imagens/')[1];
          if (filePath) await sb.storage.from('imagens').remove([filePath]);
      }
      await sb.from('usuarios_clientes').update({ logo_url: null }).eq('id', EMPRESA_ID);
      sessionStorage.setItem('microcred_logo', DEFAULT_LOGO);
      localStorage.setItem('microcred_saved_logo', DEFAULT_LOGO); 
      document.getElementById('sidebarLogo').src = DEFAULT_LOGO;
      document.getElementById('previewLogoPlano').src = DEFAULT_LOGO;
      document.getElementById('uploadLogoPlano').value = '';
      showToast('Logótipo excluído! Padrão restaurado.', 'success');
    } catch (e) { showToast('Erro ao excluir: ' + e.message, 'error'); }
  }

  function previewLogo(event) {
    const file = event.target.files[0];
    if (file) { const r = new FileReader(); r.onload = function(e) { document.getElementById('previewLogoPlano').src = e.target.result; }; r.readAsDataURL(file); }
  }

  async function saveLogoPlano() {
    const file = document.getElementById('uploadLogoPlano').files[0];
    if(!file) return showToast('Selecione uma imagem primeiro.', 'error');
    const btn = document.getElementById('btnSalvarLogoPlano');
    btn.textContent = 'Enviando...'; btn.disabled = true;
    try {
      const { data: currentData } = await sb.from('usuarios_clientes').select('logo_url').eq('id', EMPRESA_ID).single();
      if (currentData && currentData.logo_url && currentData.logo_url.includes('/storage/v1/object/public/imagens/logos/')) {
          const filePath = currentData.logo_url.split('/public/imagens/')[1];
          if (filePath) await sb.storage.from('imagens').remove([filePath]);
      }
      const url = await uploadFileToSupabase(file, 'logos');
      await sb.from('usuarios_clientes').update({ logo_url: url }).eq('id', EMPRESA_ID);
      sessionStorage.setItem('microcred_logo', url); localStorage.setItem('microcred_saved_logo', url);
      document.getElementById('sidebarLogo').src = url; document.getElementById('previewLogoPlano').src = url; 
      showToast('Logótipo atualizado com sucesso!', 'success');
    } catch(e) { showToast('Falha: ' + e.message, 'error'); } finally { btn.textContent = 'Atualizar Logótipo'; btn.disabled = false; }
  }

  // =============================================
  // DASHBOARD E GRÁFICOS
  // =============================================
  async function loadDashboard() {
    const [cRes, oRes, pRes, iRes] = await Promise.all([
      sb.from('clientes').select('id', { count: 'exact', head: true }).eq('empresa_id', EMPRESA_ID),
      sb.from('operacoes').select('*').eq('empresa_id', EMPRESA_ID),
      sb.from('parcelas').select('*').eq('empresa_id', EMPRESA_ID).in('status', ['pendente','atrasada','paga']),
      sb.from('parcelas').select('id', { count: 'exact', head: true }).eq('empresa_id', EMPRESA_ID).eq('status', 'atrasada'),
    ]);
    const totalClientes = cRes.count || 0;
    const ops = oRes.data || [];
    const parcelasAll = pRes.data || [];
    
    const ativas = ops.filter(o => ['liberada', 'em_andamento'].includes(o.status));
    const totalCarteira = ativas.reduce((s, o) => s + Number(o.valor_aprovado || o.valor_solicitado || 0), 0);
    const totalAtrasadas = iRes.count || 0;
    
    // Calcular recebido este mês
    const now = new Date();
    const mesAtual = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const recebidoMes = parcelasAll.filter(p => p.status === 'paga' && (p.data_pagamento || '').startsWith(mesAtual)).reduce((s,p) => s+Number(p.valor_pago||0), 0);

    // Alertas de vencimento
    const today = now.toISOString().slice(0,10);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
    const tomorrowStr = tomorrow.toISOString().slice(0,10);
    const venceHoje = parcelasAll.filter(p => p.data_vencimento === today && p.status === 'pendente').length;
    const venceAmanha = parcelasAll.filter(p => p.data_vencimento === tomorrowStr && p.status === 'pendente').length;

    // Atualiza sino de alertas
    const _alertBadge = document.getElementById('alertBadge');
    const _alertList  = document.getElementById('alertDropList');
    let _alertCount = 0, _alertItems = '';
    if (totalAtrasadas > 0) { _alertCount += totalAtrasadas; _alertItems += '<div onclick="navigate(\'inadimplencia\');toggleAlertDropdown()" style="background:var(--danger-bg);border:1px solid rgba(229,57,53,0.2);border-radius:10px;padding:10px 12px;cursor:pointer;margin-bottom:4px;"><b style="color:var(--danger-text);">⚠️ ' + totalAtrasadas + ' parcela' + (totalAtrasadas>1?'s':'') + ' em atraso</b><div style="font-size:11px;color:var(--danger-text);opacity:.75;">Ver inadimplência →</div></div>'; }
    if (venceHoje > 0) { _alertCount += venceHoje; _alertItems += '<div onclick="navigate(\'parcelas\');toggleAlertDropdown()" style="background:var(--warning-bg);border:1px solid rgba(255,171,0,0.2);border-radius:10px;padding:10px 12px;cursor:pointer;margin-bottom:4px;"><b style="color:var(--warning-text);">🕐 ' + venceHoje + ' vencem hoje</b></div>'; }
    if (venceAmanha > 0) { _alertItems += '<div style="background:rgba(255,171,0,0.05);border:1px solid rgba(255,171,0,0.12);border-radius:10px;padding:10px 12px;"><b style="color:var(--warning-text);">📅 ' + venceAmanha + ' vencem amanhã</b></div>'; }
    if (_alertList) _alertList.innerHTML = _alertItems || '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:16px;">✅ Sem alertas</div>';
    if (_alertBadge) { if (_alertCount > 0) { _alertBadge.style.display='flex'; _alertBadge.textContent=String(_alertCount); } else _alertBadge.style.display='none'; }

    // Badge na sidebar de agenda
    const badge = document.getElementById('agendaBadge');
    const totalBadge = venceHoje + venceAmanha + totalAtrasadas;
    if (badge && totalBadge > 0) { badge.textContent = totalBadge; badge.style.display = 'inline'; }

    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card accent"><div class="label">Total Clientes</div><div class="value">${totalClientes}</div></div>
      <div class="stat-card info"><div class="label">Operações Ativas</div><div class="value">${ativas.length}</div></div>
      <div class="stat-card success"><div class="label">Carteira Ativa</div><div class="value">${fmt(totalCarteira)}</div></div>
      <div class="stat-card danger"><div class="label">Parcelas Atrasadas</div><div class="value">${totalAtrasadas}</div></div>
    `;

    // Vencimentos próximos no painel lateral
    const vencEl = document.getElementById('dashVencimentos');
    if (vencEl) {
      const proximos = parcelasAll
        .filter(p => ['pendente','atrasada'].includes(p.status) && p.data_vencimento <= tomorrowStr)
        .sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 8);
      if (proximos.length === 0) {
        vencEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text-light);font-size:13px;">✅ Nenhum vencimento urgente</div>';
      } else {
        // Buscar nomes
        const cIds = [...new Set(proximos.map(p => p.operacao_id).filter(Boolean))];
        const { data: opNames } = await sb.from('operacoes').select('id,cliente_id,clientes(nome)').in('id', cIds).eq('empresa_id', EMPRESA_ID);
        const opMap = {}; (opNames||[]).forEach(o => opMap[o.id] = o.clientes?.nome || '?');
        vencEl.innerHTML = proximos.map(p => {
          const isAtrasada = p.status === 'atrasada';
          const cor = isAtrasada ? '#e53935' : '#ff8f00';
          const inicial = (opMap[p.operacao_id] || '?').charAt(0).toUpperCase();
          return `<div class="agenda-item">
            <div class="agenda-avatar" style="background:${isAtrasada ? 'linear-gradient(135deg,#e53935,#ff5252)' : 'linear-gradient(135deg,#ff8f00,#ffab00)'};">${inicial}</div>
            <div class="agenda-info">
              <div class="agenda-name">${opMap[p.operacao_id] || 'Cliente'}</div>
              <div class="agenda-sub">${isAtrasada ? '⚠️ Atrasada' : '⏰ Vence hoje/amanhã'} · ${fmtDate(p.data_vencimento)}</div>
            </div>
            <div class="agenda-valor" style="color:${cor};">${fmt(p.valor_total)}</div>
          </div>`;
        }).join('');
      }
    }

    const ctxStatus = document.getElementById('dashChartStatus').getContext('2d');
    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctxStatus, {
       type: 'doughnut',
       data: {
          labels: ['Em Análise', 'Aprovada', 'Liberada', 'Em Andamento', 'Quitada', 'Inadimplente'],
          datasets: [{
             data: [
                ops.filter(o=>o.status==='em_analise').length,
                ops.filter(o=>o.status==='aprovada').length,
                ops.filter(o=>o.status==='liberada').length,
                ops.filter(o=>o.status==='em_andamento').length,
                ops.filter(o=>o.status==='quitada').length,
                ops.filter(o=>o.status==='inadimplente').length,
             ],
             backgroundColor: ['#3b82f6', '#10b981', '#0ea5e9', '#f59e0b', '#059669', '#ef4444']
          }]
       },
       options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    const valRecebido = parcelasAll.filter(p=>p.status==='paga').reduce((s,p)=>s+Number(p.valor_pago||0),0);
    const valAtrasado = parcelasAll.filter(p=>p.status==='atrasada').reduce((s,p)=>s+Number(p.valor_total||0),0);

    const ctxFin = document.getElementById('dashChartFin').getContext('2d');
    if (chartFinInstance) chartFinInstance.destroy();
    chartFinInstance = new Chart(ctxFin, {
       type: 'bar',
       data: {
          labels: ['Carteira Ativa', 'Recebido', 'Atrasado'],
          datasets: [{
             label: 'Valores em R$',
             data: [totalCarteira, valRecebido, valAtrasado],
             backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
             borderRadius: 4
          }]
       },
       options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const lastOps = ops.slice(-8).reverse();
    const opIds = lastOps.map(o => o.cliente_id);
    const { data: clienteNames } = await sb.from('clientes').select('id,nome').eq('empresa_id', EMPRESA_ID).in('id', opIds);
    const nameMap = {};
    (clienteNames || []).forEach(c => nameMap[c.id] = c.nome);
    document.getElementById('dashOperacoes').innerHTML = lastOps.map(o => `
      <tr><td>${o.numero_contrato || '-'}</td><td><strong>${nameMap[o.cliente_id] || '-'}</strong></td><td>${fmt(o.valor_aprovado || o.valor_solicitado)}</td><td>${o.num_parcelas}x</td><td>${statusBadge(o.status)}</td><td>${fmtDate(o.data_contratacao)}</td></tr>
    `).join('') || '<tr><td colspan="6" class="empty-state">Nenhuma operação registada</td></tr>';
  }

  // =============================================
  // CLIENTES & AVALISTAS (Unificado)
  // =============================================
  async function loadClientes() {
    const search = (document.getElementById('searchClientes')?.value || '').trim().toLowerCase();
    const filtroTipo = document.getElementById('filterTipoCliente')?.value || '';

    const [resC, resA] = await Promise.all([
      sb.from('clientes').select('*').eq('empresa_id', EMPRESA_ID).order('nome'),
      sb.from('avalistas').select('*,cliente:clientes(nome)').eq('empresa_id', EMPRESA_ID).order('nome'),
    ]);

    let clientes  = (resC.data || []).map(r => ({ ...r, _tipo: 'cliente' }));
    let avalistas = (resA.data || []).map(r => ({ ...r, _tipo: 'avalista' }));

    let todos = [...clientes, ...avalistas];
    if (search) todos = todos.filter(r => (r.nome||'').toLowerCase().includes(search) || (r.cpf||'').includes(search));
    if (filtroTipo) todos = todos.filter(r => r._tipo === filtroTipo);
    todos.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));

    document.getElementById('tblClientes').innerHTML = todos.map(r => {
      const isAv  = r._tipo === 'avalista';
      const rowId = (isAv ? 'a:' : 'c:') + r.id;
      const ini   = (r.nome||'?').charAt(0).toUpperCase();
      const colors = ['#ff5722','#2979ff','#00b248','#ff8f00','#9c27b0','#00bcd4'];
      const cor   = isAv ? '#2979ff' : colors[(r.nome||'').charCodeAt(0) % colors.length];
      const tel   = r.celular || r.telefone || '';
      const nomeEsc = (r.nome||'').replace(/'/g,"\\'");
      const tipoBadge = isAv
        ? `<span class="badge badge-info" style="font-size:10px;">Avalista${r.cliente?.nome ? ' de '+r.cliente.nome : ''}</span>`
        : `<span class="badge badge-success" style="font-size:10px;">Cliente</span>`;

      return `<tr>
        <td style="min-width:220px;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:${cor};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;font-family:'Outfit',sans-serif;flex-shrink:0;margin-top:2px;">${ini}</div>
            <div>
              <div style="font-weight:700;font-size:13.5px;margin-bottom:2px;">${r.nome}</div>
              <div style="font-size:11px;color:var(--text-light);margin-bottom:6px;">${r.email||''}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px;">
                ${!isAv ? `<button class="btn btn-info btn-sm" style="font-size:11px;padding:3px 9px;" onclick="viewCliente('${r.id}')">
                  <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  Ver</button>` : ''}
                ${tel ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 9px;background:linear-gradient(135deg,#1a7a4a,#25d366);color:#fff;border:none;gap:4px;" onclick="openWhatsApp('${tel}','${nomeEsc}')">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.9 9.9 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M11.998 2C6.473 2 2 6.473 2 11.998c0 1.988.583 3.843 1.59 5.397L2 22l4.766-1.543A9.96 9.96 0 0011.998 22C17.523 22 22 17.527 22 12.002 22 6.473 17.523 2 11.998 2zm0 17.925a7.912 7.912 0 01-4.037-1.105l-.29-.172-2.998.97.998-2.918-.189-.3A7.916 7.916 0 014.075 12c0-4.367 3.556-7.923 7.923-7.923s7.923 3.556 7.923 7.923-3.556 7.925-7.923 7.925z"/></svg>WA</button>` : ''}
                ${!isAv ? `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 9px;" onclick="printCliente('${r.id}')">
                  <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>PDF</button>` : ''}
                <button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 9px;" onclick="editRegistro('${rowId}')">
                  <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Editar</button>
                <button class="btn btn-danger btn-sm" style="font-size:11px;padding:3px 9px;" onclick="deleteRegistro('${rowId}')">
                  <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Apagar</button>
              </div>
            </div>
          </div>
        </td>
        <td>${tipoBadge}</td>
        <td style="font-family:'Outfit',sans-serif;font-size:13px;">${r.cpf||'-'}</td>
        <td>${tel ? `<a href="https://api.whatsapp.com/send?phone=55${tel.replace(/\D/g,'')}" target="_blank" style="color:var(--success-text);text-decoration:none;font-weight:600;">${tel}</a>` : '-'}</td>
        <td>${r.cidade||'-'}${r.uf?'/'+r.uf:''}</td>
        <td>${r._tipo === 'cliente' ? statusBadge(r.status) : '<span class="badge badge-neutral">—</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-state">Nenhum registro encontrado</td></tr>';
  }

  async function editRegistro(rowId) {
    const [tipo, id] = rowId.split(':');
    if (tipo === 'c') {
      const { data } = await sb.from('clientes').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single();
      if (data) openClienteModal(data, 'cliente');
    } else {
      const { data } = await sb.from('avalistas').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single();
      if (data) openClienteModal(data, 'avalista');
    }
  }

  async function deleteRegistro(rowId) {
    const [tipo, id] = rowId.split(':');
    const label = tipo === 'c' ? 'cliente' : 'avalista';
    if (!confirm(`Apagar este ${label}?`)) return;
    if (tipo === 'c') {
      await sb.from('clientes').delete().eq('id', id).eq('empresa_id', EMPRESA_ID);
    } else {
      await sb.from('avalistas').delete().eq('id', id).eq('empresa_id', EMPRESA_ID);
    }
    showToast('Registro apagado.', 'success');
    loadClientes();
  }

  // Mantém compatibilidade com chamadas legadas
  async function editCliente(id) { editRegistro('c:' + id); }
  async function deleteCliente(id) { deleteRegistro('c:' + id); }

  async function viewCliente(id) {
     const { data: c } = await sb.from('clientes').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single();
     if(!c) return;
     // Buscar avalista
     const { data: avs } = await sb.from('avalistas').select('*').eq('cliente_id', id).eq('empresa_id', EMPRESA_ID).order('nome').limit(1);
     const av = avs?.[0];

     document.getElementById('viewNome').textContent = c.nome;
     let docsHtml = '';
     if(c.doc_frente) docsHtml += `<div style="margin-top:10px;"><p style="font-size:12px;color:var(--text-light)">Doc Frente:</p><img src="${c.doc_frente}" style="max-width:100%; border-radius:6px; margin-top:5px; border:1px solid #ccc; max-height:200px;" /></div>`;
     if(c.doc_verso) docsHtml += `<div style="margin-top:10px;"><p style="font-size:12px;color:var(--text-light)">Doc Verso:</p><img src="${c.doc_verso}" style="max-width:100%; border-radius:6px; margin-top:5px; border:1px solid #ccc; max-height:200px;" /></div>`;
     if(c.foto_atividade) docsHtml += `<div style="margin-top:10px;"><p style="font-size:12px;color:var(--text-light)">Foto Atividade Comercial:</p><img src="${c.foto_atividade}" style="max-width:100%; border-radius:6px; margin-top:5px; border:1px solid #ccc; max-height:200px;" /></div>`;

     const avHtml = av ? `
        <div class="detail-item" style="grid-column:1/-1;border-top:2px solid var(--primary);margin-top:10px;padding-top:14px;">
          <div class="detail-label" style="color:var(--primary);font-size:11px;font-weight:800;margin-bottom:8px;">AVALISTA</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><div class="detail-label">Nome</div><div class="detail-value">${av.nome}</div></div>
            <div><div class="detail-label">CPF</div><div class="detail-value">${av.cpf || '-'}</div></div>
            <div><div class="detail-label">Celular</div><div class="detail-value">${av.celular || av.telefone || '-'}</div></div>
            <div><div class="detail-label">Parentesco</div><div class="detail-value">${av.parentesco || '-'}</div></div>
            ${av.endereco ? `<div style="grid-column:1/-1"><div class="detail-label">Endereço</div><div class="detail-value">${av.endereco}</div></div>` : ''}
          </div>
        </div>` : '';

     const html = `
        <div class="detail-item"><div class="detail-label">CPF</div><div class="detail-value">${c.cpf}</div></div>
        <div class="detail-item"><div class="detail-label">Nascimento</div><div class="detail-value">${fmtDate(c.data_nascimento)}</div></div>
        <div class="detail-item"><div class="detail-label">Telefone / Celular</div><div class="detail-value">${c.celular || c.telefone || '-'}</div></div>
        <div class="detail-item" style="grid-column: 1 / -1;"><div class="detail-label">Endereço</div><div class="detail-value">${c.endereco || '-'}, ${c.numero || '-'} - ${c.cidade || '-'}/${c.uf || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">E-mail</div><div class="detail-value">${c.email || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Renda Mensal</div><div class="detail-value" style="color:var(--success-text)">${fmt(c.renda_mensal)}</div></div>
        <div class="detail-item"><div class="detail-label">Despesa Mensal</div><div class="detail-value" style="color:var(--danger-text)">${fmt(c.despesa_mensal)}</div></div>
        <div class="detail-item" style="grid-column: 1 / -1;"><div class="detail-label">Observações</div><div class="detail-value">${c.observacoes || '-'}</div></div>
        ${avHtml}
        <div style="grid-column: 1 / -1; display:flex; flex-wrap: wrap; gap:10px;">${docsHtml}</div>
     `;
     document.getElementById('viewClienteBody').innerHTML = html;
     document.getElementById('btnViewPrint').setAttribute('onclick', `printCliente('${id}')`);
     document.getElementById('btnViewFluxo').setAttribute('onclick', `verFluxoCliente('${id}')`);
     document.getElementById('btnViewPrintFluxo').setAttribute('onclick', `printFluxoCliente('${id}')`);
     const tel = c.celular || c.telefone;
     if (tel) {
       document.getElementById('btnViewWA').setAttribute('onclick', `openWhatsApp('${tel}','${c.nome.replace(/'/g,"\\'")}'); closeModal('modalViewCliente');`);
       document.getElementById('btnViewWA').style.display = '';
     } else {
       document.getElementById('btnViewWA').style.display = 'none';
     }
     openModal('modalViewCliente');
  }

  async function printCliente(id) {
    const { data: c } = await sb.from('clientes').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single();
    if (!c) { showToast('Cliente não encontrado', 'error'); return; }
    const { data: avs } = await sb.from('avalistas').select('*').eq('cliente_id', id).eq('empresa_id', EMPRESA_ID).limit(1);
    const av = avs?.[0];
    
    const printWindow = window.open('', '_blank');
    const avHtml = av ? `<h2 style="color:#ea580c;margin-top:30px;">Avalista</h2><table><tr><th>Nome</th><td>${av.nome}</td></tr><tr><th>CPF</th><td>${av.cpf||'-'}</td></tr><tr><th>Celular</th><td>${av.celular||av.telefone||'-'}</td></tr><tr><th>Parentesco</th><td>${av.parentesco||'-'}</td></tr>${av.endereco?`<tr><th>Endereço</th><td>${av.endereco}</td></tr>`:''}</table>` : '';
    printWindow.document.write(`
      <html>
        <head><title>Ficha - ${c.nome}</title><style>body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; } h1 { border-bottom: 2px solid #ea580c; color: #ea580c; padding-bottom: 10px; margin-bottom: 20px; } h2 { color: #ea580c; margin-top: 28px; border-bottom: 1px solid #ffd7c9; padding-bottom: 6px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { text-align: left; padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; width: 30%; } td { padding: 10px; border-bottom: 1px solid #e2e8f0; } .doc-img { max-width: 100%; max-height: 250px; border-radius: 8px; margin-top: 10px; border: 1px solid #ccc; display: block; }</style></head>
        <body>
          <h1>Ficha de Cadastro: ${c.nome}</h1>
          <table>
            <tr><th>CPF</th><td>${c.cpf}</td></tr><tr><th>Data Nasc.</th><td>${fmtDate(c.data_nascimento)}</td></tr>
            <tr><th>Estado Civil</th><td>${c.estado_civil || '-'}</td></tr><tr><th>Escolaridade</th><td>${c.escolaridade || '-'}</td></tr>
            <tr><th>Telefone</th><td>${c.telefone || '-'}</td></tr><tr><th>Celular</th><td>${c.celular || '-'}</td></tr>
            <tr><th>E-mail</th><td>${c.email || '-'}</td></tr>
            <tr><th>Endereço</th><td>${c.endereco || '-'}, ${c.numero || '-'} ${c.complemento ? ' - ' + c.complemento : ''}<br>${c.bairro || '-'} - ${c.cidade || '-'}/${c.uf || '-'} (CEP: ${c.cep || '-'})</td></tr>
            <tr><th>Renda Mensal</th><td>${fmt(c.renda_mensal)}</td></tr><tr><th>Despesa Mensal</th><td>${fmt(c.despesa_mensal)}</td></tr><tr><th>Observações</th><td>${c.observacoes || '-'}</td></tr>
          </table>
          ${avHtml}
          ${c.doc_frente ? `<h2>Doc (Frente)</h2><img src="${c.doc_frente}" class="doc-img"/>` : ''}
          ${c.doc_verso ? `<h2>Doc (Verso)</h2><img src="${c.doc_verso}" class="doc-img"/>` : ''}
          ${c.foto_atividade ? `<h2>Foto da Atividade Comercial</h2><img src="${c.foto_atividade}" class="doc-img"/>` : ''}
          <scr' + 'ipt>setTimeout(() => { window.print(); window.close(); }, 1000);<\/scr' + 'ipt>
        </body>
      </html>`);
    printWindow.document.close();
  }

  // Ver fluxo de caixa do cliente em modal
  async function verFluxoCliente(clienteId) {
    const { data: negs } = await sb.from('micro_negocios').select('id,nome_fantasia').eq('cliente_id', clienteId).eq('empresa_id', EMPRESA_ID);
    if (!negs || negs.length === 0) { showToast('Nenhum negócio cadastrado para este cliente.', 'info'); return; }
    const negIds = negs.map(n => n.id);
    const negMap = {}; negs.forEach(n => negMap[n.id] = n.nome_fantasia);
    const { data: fluxos } = await sb.from('fluxo_caixa').select('*').in('micro_negocio_id', negIds).eq('empresa_id', EMPRESA_ID).order('mes_referencia', { ascending: false });
    if (!fluxos || fluxos.length === 0) { showToast('Nenhum fluxo de caixa registrado.', 'info'); return; }
    const rows = fluxos.map(f => {
      const receitas = (f.rec_vendas||0) + (f.rec_servicos||0) + (f.outras_receitas||0);
      const despesas = (f.custo_mercadorias||0) + (f.custo_materiais||0) + (f.aluguel||0) + (f.salarios||0) + (f.energia||0) + (f.agua||0) + (f.telefone_internet||0) + (f.transporte||0) + (f.outras_despesas||0);
      const saldo = receitas - despesas;
      return `<tr><td>${negMap[f.micro_negocio_id]||'-'}</td><td>${f.mes_referencia||'-'}</td><td style="color:var(--success-text)">${fmt(receitas)}</td><td style="color:var(--danger-text)">${fmt(despesas)}</td><td style="font-weight:700;color:${saldo>=0?'var(--success-text)':'var(--danger-text)'}">${fmt(saldo)}</td></tr>`;
    }).join('');
    const w = window.open('','_blank');
    w.document.write(`<html><head><style>body{font-family:sans-serif;padding:30px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:10px;} th{background:#f8fafc;} h1{color:#ea580c;}</style></head><body><h1>Fluxo de Caixa</h1><table><thead><tr><th>Negócio</th><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead><tbody>${rows}</tbody></table><scr` + `ipt>setTimeout(()=>{window.print();window.close();},800);<\/scr` + `ipt></body></html>`);
    w.document.close();
  }

  async function printFluxoCliente(clienteId) { verFluxoCliente(clienteId); }

  async function openClienteModal(c, tipoForcar) {
    // Determinar tipo: forçado, ou detectar pelo contexto (avalista vem da tabela avalistas)
    const tipo = tipoForcar || (c?._tipo) || 'cliente';

    document.getElementById('cTipoRegistro').value = tipo;
    document.getElementById('clienteId').value = c ? c.id : '';

    // Aplicar visual do tipo
    mudarTipoCadastro(tipo, true);

    // Se é avalista, preencher o select de cliente relacionado
    if (tipo === 'avalista') {
      await loadClienteOptions('avClienteRelacionado', c?.cliente_id);
      document.getElementById('avParentesco').value = c?.parentesco || '';
    }

    document.getElementById('modalClienteTitle').textContent = c
      ? (tipo === 'avalista' ? 'Editar Avalista' : 'Editar Cliente')
      : 'Novo Cadastro';

    document.getElementById('cDocFrente').value = ''; document.getElementById('cDocVerso').value = '';
    document.getElementById('cDocFrenteUrl').value = c?.doc_frente || ''; document.getElementById('cDocVersoUrl').value = c?.doc_verso || '';

    document.getElementById('cNome').value = c?.nome || ''; document.getElementById('cCpf').value = c?.cpf || '';
    document.getElementById('cNasc').value = c?.data_nascimento || ''; document.getElementById('cSexo').value = c?.sexo || ''; document.getElementById('cEstCivil').value = c?.estado_civil || '';
    document.getElementById('cEscol').value = c?.escolaridade || ''; document.getElementById('cTel').value = c?.telefone || ''; document.getElementById('cCel').value = c?.celular || '';
    document.getElementById('cEmail').value = c?.email || ''; document.getElementById('cCep').value = c?.cep || ''; document.getElementById('cEnd').value = c?.endereco || '';
    document.getElementById('cNum').value = c?.numero || ''; document.getElementById('cComp').value = c?.complemento || ''; document.getElementById('cBairro').value = c?.bairro || '';
    document.getElementById('cCidade').value = c?.cidade || ''; document.getElementById('cUf').value = c?.uf || '';
    // Campos GPS
    document.getElementById('cLatitude').value = c?.latitude || '';
    document.getElementById('cLongitude').value = c?.longitude || '';
    document.getElementById('cLatLng').value = (c?.latitude && c?.longitude) ? `${c.latitude}, ${c.longitude}` : '';
    document.getElementById('gpsStatus').textContent = '';
    const btnMapa = document.getElementById('btnAbrirMapa');
    if (c?.latitude && c?.longitude) {
      btnMapa.href = `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
      btnMapa.style.display = 'inline-flex';
    } else {
      btnMapa.style.display = 'none';
    }
    const btnGps = document.getElementById('btnGps');
    btnGps.innerHTML = '<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Obter Localização';
    btnGps.disabled = false;
    document.getElementById('cRenda').value = toMoneyInput(c?.renda_mensal); document.getElementById('cDespesa').value = toMoneyInput(c?.despesa_mensal);
    document.getElementById('cStatus').value = c?.status || 'ativo'; document.getElementById('cObs').value = c?.observacoes || '';
    // Reset doc previews
    ['prevDocFrente','prevDocVerso'].forEach(id => { const d = document.getElementById(id); if(d) d.style.display='none'; });
    document.getElementById('cDocFrente').value = ''; document.getElementById('cDocVerso').value = '';
    if(document.getElementById('cDocFrenteCamera')) document.getElementById('cDocFrenteCamera').value = '';
    if(document.getElementById('cDocVersoCamera')) document.getElementById('cDocVersoCamera').value = '';
    if(c?.doc_frente) { const d=document.getElementById('prevDocFrente'); if(d){d.querySelector('img').src=c.doc_frente;d.style.display='block';} }
    if(c?.doc_verso) { const d=document.getElementById('prevDocVerso'); if(d){d.querySelector('img').src=c.doc_verso;d.style.display='block';} }
    // Foto atividade
    document.getElementById('cFotoAtivUrl').value = c?.foto_atividade || '';
    document.getElementById('cFotoAtiv').value = '';
    document.getElementById('cFotoAtivCamera').value = '';
    if (c?.foto_atividade) {
      document.getElementById('previewFotoAtivImg').src = c.foto_atividade;
      document.getElementById('previewFotoAtivDiv').style.display = 'block';
    } else {
      document.getElementById('previewFotoAtivDiv').style.display = 'none';
    }
    // Avalista do cliente
    document.getElementById('cAvId').value = '';
    document.getElementById('cAvNome').value = '';
    document.getElementById('cAvCpf').value = '';
    document.getElementById('cAvCel').value = '';
    document.getElementById('cAvParent').value = '';
    document.getElementById('cAvEnd').value = '';
    if (c?.id) {
      const { data: avs } = await sb.from('avalistas').select('*').eq('cliente_id', c.id).eq('empresa_id', EMPRESA_ID).order('nome').limit(1);
      if (avs?.[0]) {
        const av = avs[0];
        document.getElementById('cAvId').value = av.id || '';
        document.getElementById('cAvNome').value = av.nome || '';
        document.getElementById('cAvCpf').value = av.cpf || '';
        document.getElementById('cAvCel').value = av.celular || av.telefone || '';
        document.getElementById('cAvParent').value = av.parentesco || '';
        document.getElementById('cAvEnd').value = av.endereco || '';
      }
    }
    // Reset select avalista e carregar lista
    document.getElementById('cAvSelect').value = '';
    carregarAvalistasSelect();

    // Mostrar/ocultar aviso de upload bloqueado
    aplicarBloqueioUpload();

    openModal('modalCliente');
  }

  async function editCliente(id) { editRegistro('c:' + id); }

  async function saveCliente() {
    const id     = document.getElementById('clienteId').value;
    const tipo   = document.getElementById('cTipoRegistro').value || 'cliente';
    const btnSave = document.getElementById('btnSaveCliente');

    const _savNome = document.getElementById('cNome').value.trim();
    const _savCpf  = document.getElementById('cCpf').value.trim();
    if (!_savNome || !_savCpf)
      return showToast('Nome e CPF são obrigatórios.', 'warning');
    // Bloqueia duplicado ao salvar (só para novos cadastros de cliente)
    if (!id && tipo !== 'avalista') {
      const { data: dup } = await sb.from('clientes').select('id,nome').eq('empresa_id', EMPRESA_ID).or('nome.ilike.%'+_savNome+'%,cpf.eq.'+_savCpf).limit(1);
      if (dup && dup.length > 0) return showToast('⚠️ "'+dup[0].nome+'" já está cadastrado com este nome ou CPF.', 'warning');
    }

    btnSave.textContent = 'A Guardar...'; btnSave.disabled = true;

    try {
      if (tipo === 'avalista') {
        // ── Salvar como AVALISTA ──
        const clienteRel = document.getElementById('avClienteRelacionado').value;
        const fotoFile   = document.getElementById('cFotoAtiv').files[0];
        let fotoUrl = '';
        if (fotoFile) fotoUrl = await uploadFileToSupabase(fotoFile, 'avalistas');

        const avObj = {
          empresa_id:  EMPRESA_ID,
          cliente_id:  clienteRel || null,
          nome:        document.getElementById('cNome').value,
          cpf:         document.getElementById('cCpf').value,
          rg:          '',
          telefone:    document.getElementById('cTel').value,
          celular:     document.getElementById('cCel').value,
          email:       document.getElementById('cEmail').value,
          endereco:    document.getElementById('cEnd').value,
          numero:      document.getElementById('cNum').value,
          bairro:      document.getElementById('cBairro').value,
          cidade:      document.getElementById('cCidade').value,
          uf:          document.getElementById('cUf').value,
          cep:         document.getElementById('cCep').value,
          renda_mensal: unmaskMoney(document.getElementById('cRenda').value),
          parentesco:  document.getElementById('avParentesco').value,
          observacoes: document.getElementById('cObs').value,
          foto_perfil: fotoUrl || null,
        };
        const { error } = id
          ? await sb.from('avalistas').update(avObj).eq('id', id).eq('empresa_id', EMPRESA_ID)
          : await sb.from('avalistas').insert(avObj);
        if (error) throw error;
        showToast(id ? 'Avalista atualizado!' : 'Avalista registado com sucesso!', 'success');
        closeModal('modalCliente'); loadClientes();

      } else {
        // ── Salvar como CLIENTE ──
        let urlFrente = document.getElementById('cDocFrenteUrl').value;
        let urlVerso  = document.getElementById('cDocVersoUrl').value;
        const fileFrente   = document.getElementById('cDocFrente').files[0] || document.getElementById('cDocFrenteCamera')?.files[0];
        if (fileFrente) urlFrente = await uploadFileToSupabase(fileFrente, 'clientes');
        const fileVerso    = document.getElementById('cDocVerso').files[0] || document.getElementById('cDocVersoCamera')?.files[0];
        if (fileVerso)  urlVerso  = await uploadFileToSupabase(fileVerso, 'clientes');
        let urlFotoAtiv = document.getElementById('cFotoAtivUrl').value;
        const fileFotoAtiv = document.getElementById('cFotoAtiv').files[0] || document.getElementById('cFotoAtivCamera').files[0];
        if (fileFotoAtiv) urlFotoAtiv = await uploadFileToSupabase(fileFotoAtiv, 'clientes');

        const obj = {
          empresa_id: EMPRESA_ID, nome: document.getElementById('cNome').value, cpf: document.getElementById('cCpf').value,
          data_nascimento: document.getElementById('cNasc').value || null, sexo: document.getElementById('cSexo').value,
          estado_civil: document.getElementById('cEstCivil').value, escolaridade: document.getElementById('cEscol').value,
          telefone: document.getElementById('cTel').value, celular: document.getElementById('cCel').value,
          email: document.getElementById('cEmail').value, cep: document.getElementById('cCep').value,
          endereco: document.getElementById('cEnd').value, numero: document.getElementById('cNum').value,
          complemento: document.getElementById('cComp').value, bairro: document.getElementById('cBairro').value,
          cidade: document.getElementById('cCidade').value, uf: document.getElementById('cUf').value,
          latitude:  document.getElementById('cLatitude').value  ? parseFloat(document.getElementById('cLatitude').value)  : null,
          longitude: document.getElementById('cLongitude').value ? parseFloat(document.getElementById('cLongitude').value) : null,
          renda_mensal: unmaskMoney(document.getElementById('cRenda').value),
          despesa_mensal: unmaskMoney(document.getElementById('cDespesa').value),
          status: 'ativo', observacoes: document.getElementById('cObs').value,
          doc_frente: urlFrente, doc_verso: urlVerso, foto_atividade: urlFotoAtiv || null,
        };

        let clienteId = id;
        const { data: savedCliente, error } = id
          ? await sb.from('clientes').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID).select('id').single()
          : await sb.from('clientes').insert(obj).select('id').single();
        if (error) throw error;
        if (!id && savedCliente) clienteId = savedCliente.id;

        // Salvar avalista embutido
        const avNome = document.getElementById('cAvNome').value.trim();
        const avId   = document.getElementById('cAvId').value;
        if (avNome && clienteId) {
          const avObj = {
            empresa_id: EMPRESA_ID, cliente_id: clienteId,
            nome: avNome, cpf: document.getElementById('cAvCpf').value,
            celular: document.getElementById('cAvCel').value,
            parentesco: document.getElementById('cAvParent').value,
            endereco: document.getElementById('cAvEnd').value,
          };
          if (avId) await sb.from('avalistas').update(avObj).eq('id', avId).eq('empresa_id', EMPRESA_ID);
          else      await sb.from('avalistas').insert(avObj);
        }

        showToast(id ? 'Cliente atualizado!' : 'Cliente registado com sucesso!', 'success');
        closeModal('modalCliente'); loadClientes();
      }
    } catch (e) { showToast('Erro: ' + e.message, 'error');
    } finally { btnSave.textContent = 'Salvar'; btnSave.disabled = false; }
  }

  async function deleteCliente(id) { deleteRegistro('c:' + id); }

  // =============================================
  // AVALISTAS – funções de compatibilidade
  // =============================================
  async function loadAvalistas() { loadClientes(); }
  async function openAvalistaModal(a) { editRegistro('a:' + (a?.id || '')); }
  async function editAvalista(id) { editRegistro('a:' + id); }
  async function saveAvalista() { saveCliente(); }
  async function deleteAvalista(id) { deleteRegistro('a:' + id); }
  async function deleteAvalista(id) { if (!confirm('Apagar avalista?')) return; await sb.from('avalistas').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); loadAvalistas(); }

  async function loadNegocios() { const search = (document.getElementById('searchNegocios')?.value || '').trim(); let q = sb.from('micro_negocios').select('*,cliente:clientes(nome)').eq('empresa_id', EMPRESA_ID).order('nome_fantasia'); if (search) q = q.ilike('nome_fantasia', `%${search}%`); const { data } = await q; document.getElementById('tblNegocios').innerHTML = (data || []).map(n => `<tr><td><strong>${n.nome_fantasia || '-'}</strong></td><td>${n.cliente?.nome || '-'}</td><td>${n.atividade || '-'}</td><td>${fmt(n.faturamento_mensal)}</td><td>${fmt(n.lucro_mensal)}</td><td><div class="btn-group"><button class="btn btn-outline btn-sm" onclick="editNegocio('${n.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteNegocio('${n.id}')">Excluir</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Nenhum negócio registado</td></tr>'; }
  function calcTempoAtividade() { const inputData = document.getElementById('nDataInicio').value; const calcOutput = document.getElementById('nTempoCalculado'); if (!inputData) { calcOutput.value = ''; return; } const dataInicio = new Date(inputData), hoje = new Date(); if (dataInicio > hoje) { calcOutput.value = 'Data no futuro'; return; } let anos = hoje.getFullYear() - dataInicio.getFullYear(); let meses = hoje.getMonth() - dataInicio.getMonth(); let dias = hoje.getDate() - dataInicio.getDate(); if (dias < 0) { meses--; const ultimoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0); dias += ultimoMes.getDate(); } if (meses < 0) { anos--; meses += 12; } const partes = []; if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`); if (meses > 0) partes.push(`${meses} mês${meses > 1 ? 'es' : ''}`); if (dias > 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`); calcOutput.value = partes.length > 0 ? partes.join(', ') : 'Menos de 1 dia'; }
  async function openNegocioModal(n) { document.getElementById('modalNegocioTitle').textContent = n ? 'Editar Negócio' : 'Novo Negócio'; await loadClienteOptions('nCliente', n?.cliente_id); document.getElementById('negocioId').value = n?.id || ''; document.getElementById('nNome').value = n?.nome_fantasia || ''; document.getElementById('nCpf').value = n?.cpf || ''; document.getElementById('nAtiv').value = n?.atividade || ''; document.getElementById('nSetor').value = n?.setor || ''; document.getElementById('nDataInicio').value = n?.data_inicio || ''; calcTempoAtividade(); document.getElementById('nEnd').value = n?.endereco_comercial || ''; document.getElementById('nNum').value = n?.numero || ''; document.getElementById('nBairro').value = n?.bairro || ''; document.getElementById('nCidade').value = n?.cidade || ''; document.getElementById('nUf').value = n?.uf || ''; document.getElementById('nCep').value = n?.cep || ''; document.getElementById('nFat').value = toMoneyInput(n?.faturamento_mensal); document.getElementById('nCusto').value = toMoneyInput(n?.custo_mensal); document.getElementById('nLucro').value = toMoneyInput(n?.lucro_mensal); document.getElementById('nFunc').value = n?.num_funcionarios || ''; document.getElementById('nTipoLocal').value = n?.tipo_local || ''; document.getElementById('nObs').value = n?.observacoes || ''; openModal('modalNegocio'); }
  async function editNegocio(id) { const { data } = await sb.from('micro_negocios').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single(); if (data) openNegocioModal(data); }
  async function saveNegocio() { const id = document.getElementById('negocioId').value; const obj = { empresa_id: EMPRESA_ID, cliente_id: document.getElementById('nCliente').value || null, nome_fantasia: document.getElementById('nNome').value, cpf: document.getElementById('nCpf').value, atividade: document.getElementById('nAtiv').value, setor: document.getElementById('nSetor').value, data_inicio: document.getElementById('nDataInicio').value || null, endereco_comercial: document.getElementById('nEnd').value, numero: document.getElementById('nNum').value, bairro: document.getElementById('nBairro').value, cidade: document.getElementById('nCidade').value, uf: document.getElementById('nUf').value, cep: document.getElementById('nCep').value, faturamento_mensal: unmaskMoney(document.getElementById('nFat').value), custo_mensal: unmaskMoney(document.getElementById('nCusto').value), lucro_mensal: unmaskMoney(document.getElementById('nLucro').value), num_funcionarios: parseInt(document.getElementById('nFunc').value) || 0, tipo_local: document.getElementById('nTipoLocal').value, observacoes: document.getElementById('nObs').value, }; await (id ? sb.from('micro_negocios').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID) : sb.from('micro_negocios').insert(obj)); closeModal('modalNegocio'); loadNegocios(); }
  async function deleteNegocio(id) { if (!confirm('Excluir?')) return; await sb.from('micro_negocios').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); loadNegocios(); }

  // =============================================
  // AVALIAÇÃO FINANCEIRA E FLUXO DE CAIXA
  // =============================================
  async function loadAvaliacoes() { const { data } = await sb.from('avaliacao_financeira').select('*,cliente:clientes(nome)').eq('empresa_id', EMPRESA_ID).order('created_at', { ascending: false }); document.getElementById('tblAvaliacao').innerHTML = (data || []).map(a => `<tr><td>${a.cliente?.nome || '-'}</td><td>${fmt(a.renda_familiar)}</td><td>${fmt(a.capacidade_pagamento)}</td><td>${a.aprovado ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-danger">Não</span>'}</td><td>${fmtDate(a.data_avaliacao)}</td><td><div class="btn-group"><button class="btn btn-outline btn-sm" onclick="editAvaliacao('${a.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteAvaliacao('${a.id}')">Apagar</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Nenhuma avaliação registada</td></tr>'; }
  async function openAvaliacaoModal(a) { document.getElementById('modalAvaliacaoTitle').textContent = a ? 'Editar Avaliação' : 'Nova Avaliação'; await loadClienteOptions('avCliente', a?.cliente_id); document.getElementById('avaliacaoId').value = a?.id || ''; document.getElementById('avRendaFam').value = toMoneyInput(a?.renda_familiar); document.getElementById('avOutrasRendas').value = toMoneyInput(a?.outras_rendas); document.getElementById('avDespFixas').value = toMoneyInput(a?.despesas_fixas); document.getElementById('avDespVar').value = toMoneyInput(a?.despesas_variaveis); document.getElementById('avPrestacoes').value = toMoneyInput(a?.prestacoes_existentes); document.getElementById('avPatrimonio').value = toMoneyInput(a?.patrimonio_estimado); document.getElementById('avDividas').value = toMoneyInput(a?.dividas_existentes); document.getElementById('avCapacidade').value = toMoneyInput(a?.capacidade_pagamento); document.getElementById('avAvaliador').value = a?.avaliador || ''; document.getElementById('avAprovado').value = a?.aprovado ? 'true' : 'false'; document.getElementById('avParecer').value = a?.parecer || ''; openModal('modalAvaliacao'); }
  async function editAvaliacao(id) { const { data } = await sb.from('avaliacao_financeira').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single(); if (data) openAvaliacaoModal(data); }
  async function saveAvaliacao() { const obj = { empresa_id: EMPRESA_ID, cliente_id: document.getElementById('avCliente').value || null, renda_familiar: unmaskMoney(document.getElementById('avRendaFam').value), outras_rendas: unmaskMoney(document.getElementById('avOutrasRendas').value), despesas_fixas: unmaskMoney(document.getElementById('avDespFixas').value), despesas_variaveis: unmaskMoney(document.getElementById('avDespVar').value), prestacoes_existentes: unmaskMoney(document.getElementById('avPrestacoes').value), patrimonio_estimado: unmaskMoney(document.getElementById('avPatrimonio').value), dividas_existentes: unmaskMoney(document.getElementById('avDividas').value), capacidade_pagamento: unmaskMoney(document.getElementById('avCapacidade').value), avaliador: document.getElementById('avAvaliador').value, aprovado: document.getElementById('avAprovado').value === 'true', parecer: document.getElementById('avParecer').value, }; const id = document.getElementById('avaliacaoId').value; await (id ? sb.from('avaliacao_financeira').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID) : sb.from('avaliacao_financeira').insert(obj)); closeModal('modalAvaliacao'); loadAvaliacoes(); }
  async function deleteAvaliacao(id) { if (!confirm('Apagar?')) return; await sb.from('avaliacao_financeira').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); loadAvaliacoes(); }

  async function loadFluxos() { const { data } = await sb.from('fluxo_caixa').select('*,negocio:micro_negocios(nome_fantasia)').eq('empresa_id', EMPRESA_ID).order('mes_referencia', { ascending: false }); document.getElementById('tblFluxo').innerHTML = (data || []).map(f => `<tr><td>${f.negocio?.nome_fantasia || '-'}</td><td>${f.mes_referencia}</td><td>${fmt(f.total_receitas)}</td><td>${fmt(f.total_despesas)}</td><td style="font-weight:700;color:${f.saldo >= 0 ? 'var(--success-text)' : 'var(--danger-text)'}">${fmt(f.saldo)}</td><td><div class="btn-group"><button class="btn btn-outline btn-sm" onclick="editFluxo('${f.id}')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteFluxo('${f.id}')">Apagar</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Nenhum fluxo registado</td></tr>'; }
  async function openFluxoModal(f) { document.getElementById('modalFluxoTitle').textContent = f ? 'Editar Fluxo' : 'Novo Fluxo'; await loadNegocioOptions('fNegocio', f?.micro_negocio_id); document.getElementById('fluxoId').value = f?.id || ''; document.getElementById('fMes').value = f?.mes_referencia || ''; document.getElementById('fRecVendas').value = toMoneyInput(f?.receita_vendas); document.getElementById('fRecServ').value = toMoneyInput(f?.receita_servicos); document.getElementById('fOutrasRec').value = toMoneyInput(f?.outras_receitas); document.getElementById('fCustoMerc').value = toMoneyInput(f?.custo_mercadorias); document.getElementById('fCustoMat').value = toMoneyInput(f?.custo_materiais); document.getElementById('fAluguel').value = toMoneyInput(f?.despesa_aluguel); document.getElementById('fSalarios').value = toMoneyInput(f?.despesa_salarios); document.getElementById('fEnergia').value = toMoneyInput(f?.despesa_energia); document.getElementById('fAgua').value = toMoneyInput(f?.despesa_agua); document.getElementById('fTelefone').value = toMoneyInput(f?.despesa_telefone); document.getElementById('fTransporte').value = toMoneyInput(f?.despesa_transporte); document.getElementById('fOutrasDesp').value = toMoneyInput(f?.outras_despesas); openModal('modalFluxo'); }
  async function editFluxo(id) { const { data } = await sb.from('fluxo_caixa').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single(); if (data) openFluxoModal(data); }
  async function saveFluxo() { const rv = unmaskMoney(document.getElementById('fRecVendas').value); const rs = unmaskMoney(document.getElementById('fRecServ').value); const ro = unmaskMoney(document.getElementById('fOutrasRec').value); const cm = unmaskMoney(document.getElementById('fCustoMerc').value); const cmat = unmaskMoney(document.getElementById('fCustoMat').value); const da = unmaskMoney(document.getElementById('fAluguel').value); const ds = unmaskMoney(document.getElementById('fSalarios').value); const de = unmaskMoney(document.getElementById('fEnergia').value); const dag = unmaskMoney(document.getElementById('fAgua').value); const dt = unmaskMoney(document.getElementById('fTelefone').value); const dtr = unmaskMoney(document.getElementById('fTransporte').value); const dout = unmaskMoney(document.getElementById('fOutrasDesp').value); const totalR = rv + rs + ro; const totalD = cm + cmat + da + ds + de + dag + dt + dtr + dout; const obj = { empresa_id: EMPRESA_ID, micro_negocio_id: document.getElementById('fNegocio').value || null, mes_referencia: document.getElementById('fMes').value, receita_vendas: rv, receita_servicos: rs, outras_receitas: ro, custo_mercadorias: cm, custo_materiais: cmat, despesa_aluguel: da, despesa_salarios: ds, despesa_energia: de, despesa_agua: dag, despesa_telefone: dt, despesa_transporte: dtr, outras_despesas: dout, total_receitas: totalR, total_despesas: totalD, saldo: totalR - totalD, }; const id = document.getElementById('fluxoId').value; await (id ? sb.from('fluxo_caixa').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID) : sb.from('fluxo_caixa').insert(obj)); closeModal('modalFluxo'); loadFluxos(); }
  async function deleteFluxo(id) { if (!confirm('Apagar?')) return; await sb.from('fluxo_caixa').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); loadFluxos(); }

  // =============================================
  // OPERAÇÕES (Totalmente reescrito com proteção anti-bugs)
  // =============================================
  async function loadOperacoes() { 
    try {
      const searchStr = (document.getElementById('searchOperacoes')?.value || '').trim().toLowerCase(); 
      const status = document.getElementById('filterStatusOp')?.value; 
      const dateFilter = document.getElementById('filterOpDate')?.value; 
      
      let q = sb.from('operacoes').select('*,cliente:clientes(nome,cpf)').eq('empresa_id', EMPRESA_ID).order('created_at', { ascending: false }); 
      if (status) q = q.eq('status', status); 
      if (dateFilter) q = q.eq('data_contratacao', dateFilter); 
      
      let { data, error } = await q; 
      if(error) throw error;
      
      if (searchStr) { 
        data = (data || []).filter(o => (o.numero_contrato && o.numero_contrato.toLowerCase().includes(searchStr)) || (o.cliente?.nome && o.cliente.nome.toLowerCase().includes(searchStr)) || (o.cliente?.cpf && o.cliente.cpf.includes(searchStr)) ); 
      } 
      
      // Buscar progresso de parcelas pagas para cada operação
      const opIds = (data||[]).map(o => o.id);
      let progressMap = {};
      if (opIds.length > 0) {
        const { data: parcsCount } = await sb.from('parcelas').select('operacao_id,status').eq('empresa_id', EMPRESA_ID).in('operacao_id', opIds);
        (parcsCount||[]).forEach(p => {
          if (!progressMap[p.operacao_id]) progressMap[p.operacao_id] = { total: 0, pagas: 0 };
          progressMap[p.operacao_id].total++;
          if (p.status === 'paga') progressMap[p.operacao_id].pagas++;
        });
      }
      document.getElementById('tblOperacoes').innerHTML = (data || []).map(o => {
        const prog = progressMap[o.id] || { total: o.num_parcelas, pagas: 0 };
        const pct = prog.total > 0 ? Math.round((prog.pagas / prog.total) * 100) : 0;
        const progColor = pct >= 80 ? '#00c853' : pct >= 40 ? '#ffab00' : '#2979ff';
        return `<tr>
          <td><strong style="font-family:'Outfit',sans-serif;">${o.numero_contrato || '-'}</strong></td>
          <td>${o.cliente?.nome || '-'}</td>
          <td style="font-family:'Outfit',sans-serif;font-weight:700;">${fmt(o.valor_aprovado || o.valor_solicitado)}</td>
          <td><span class="badge badge-neutral" style="font-family:'Outfit',sans-serif;">${o.taxa_juros}% a.m.</span></td>
          <td>
            <div style="font-size:12px;font-weight:700;font-family:'Outfit',sans-serif;margin-bottom:3px;">${prog.pagas}/${prog.total > 0 ? prog.total : o.num_parcelas}x</div>
            <div class="progress-bar-wrap" style="width:80px;">
              <div class="progress-bar-fill" style="width:${pct}%;background:${progColor};"></div>
            </div>
          </td>
          <td>${statusBadge(o.status)}</td>
          <td style="color:var(--text-light);font-size:12px;">${fmtDate(o.data_contratacao)}</td>
          <td><div class="btn-group"><button class="btn btn-outline btn-sm" onclick="editOperacao('${o.id}')">Editar</button><button class="btn btn-success btn-sm" onclick="gerarParcelas('${o.id}')">Parcelas</button><button class="btn btn-danger btn-sm" onclick="deleteOperacao('${o.id}')">Apagar</button></div></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="empty-state">Nenhuma operação registada</td></tr>'; 
    } catch(e) {
      showToast('Erro ao listar operações: ' + e.message, 'error');
    }
  }
  
  async function openOperacaoModal(o) { 
    document.getElementById('modalOperacaoTitle').textContent = o ? 'Editar Operação' : 'Nova Operação'; 
    await loadClienteOptions('opCliente', o?.cliente_id); 
    document.getElementById('operacaoId').value = o?.id || ''; 
    document.getElementById('opContrato').value = o?.numero_contrato || ''; 
    document.getElementById('opValorSolic').value = toMoneyInput(o?.valor_solicitado); 
    document.getElementById('opValorAprov').value = toMoneyInput(o?.valor_aprovado); 
    document.getElementById('opTaxa').value = o?.taxa_juros ?? 2.5; 
    document.getElementById('opNumParc').value = o?.num_parcelas || 12; 
    document.getElementById('opDataContr').value = o?.data_contratacao || new Date().toISOString().slice(0,10); 
    document.getElementById('opDataVenc').value = o?.data_primeiro_vencimento || ''; 
    document.getElementById('opFinalidade').value = o?.finalidade || ''; 
    document.getElementById('opGarantia').value = o?.garantia || ''; 
    document.getElementById('opStatus').value = o?.status || 'em_analise'; 
    document.getElementById('opObs').value = o?.observacoes || ''; 
    
    // Esconde o botão de gerar parcelas se já for uma edição
    document.getElementById('btnSaveOpParcelas').style.display = o ? 'none' : 'inline-flex'; 
    
    if (o?.cliente_id) {
        await loadClienteAvalistas(); 
        // BUG CORRIGIDO: Selecionar o avalista e negócio APÓS carregar as opções
        document.getElementById('opAvalista').value = o.avalista_id || '';
        document.getElementById('opNegocio').value = o.micro_negocio_id || '';
    } else {
        document.getElementById('opAvalista').innerHTML = '<option value="">Nenhum</option>';
        document.getElementById('opNegocio').innerHTML = '<option value="">Nenhum</option>';
    }

    openModal('modalOperacao'); 
  }
  
  async function loadClienteAvalistas() { 
    const cid = document.getElementById('opCliente').value; 
    if (!cid) return; 
    const [aRes, nRes] = await Promise.all([ sb.from('avalistas').select('id,nome').eq('cliente_id', cid).eq('empresa_id', EMPRESA_ID), sb.from('micro_negocios').select('id,nome_fantasia').eq('cliente_id', cid).eq('empresa_id', EMPRESA_ID), ]); 
    document.getElementById('opAvalista').innerHTML = '<option value="">Nenhum</option>' + (aRes.data || []).map(a => `<option value="${a.id}">${a.nome}</option>`).join(''); 
    document.getElementById('opNegocio').innerHTML = '<option value="">Nenhum</option>' + (nRes.data || []).map(n => `<option value="${n.id}">${n.nome_fantasia}</option>`).join(''); 
  }

  async function editOperacao(id) { 
    try {
      const { data, error } = await sb.from('operacoes').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single(); 
      if (error) throw error;
      if (data) openOperacaoModal(data); 
    } catch(e) {
      showToast('Erro ao abrir operação: ' + e.message, 'error');
    }
  }
  
  async function saveOperacao() { 
    const btn = document.getElementById('btnSaveOperacao');
    const originalText = btn.textContent;
    btn.textContent = 'A Guardar...'; btn.disabled = true;

    try {
        const id = document.getElementById('operacaoId').value; 
        const vAprov = unmaskMoney(document.getElementById('opValorAprov').value); 
        const vSolic = unmaskMoney(document.getElementById('opValorSolic').value); 
        const valor = vAprov || vSolic || 0; 
        const taxa = parseFloat(document.getElementById('opTaxa').value) || 0; 
        const nparc = parseInt(document.getElementById('opNumParc').value) || 1; 
        
        const taxaDec = taxa / 100;
        const pmt = taxa > 0 ? (valor * taxaDec * Math.pow(1 + taxaDec, nparc)) / (Math.pow(1 + taxaDec, nparc) - 1) : valor / nparc; 
        
        const obj = { 
          empresa_id: EMPRESA_ID, 
          numero_contrato: document.getElementById('opContrato').value, 
          cliente_id: document.getElementById('opCliente').value || null, 
          avalista_id: document.getElementById('opAvalista').value || null, 
          micro_negocio_id: document.getElementById('opNegocio').value || null, 
          valor_solicitado: vSolic, 
          valor_aprovado: vAprov, 
          taxa_juros: taxa, 
          num_parcelas: nparc, 
          valor_parcela: Math.round(pmt * 100) / 100, 
          data_contratacao: document.getElementById('opDataContr').value || null, 
          data_primeiro_vencimento: document.getElementById('opDataVenc').value || null, 
          finalidade: document.getElementById('opFinalidade').value, 
          garantia: document.getElementById('opGarantia').value, 
          status: document.getElementById('opStatus').value, 
          observacoes: document.getElementById('opObs').value, 
        }; 
        
        const { error } = id ? await sb.from('operacoes').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID) : await sb.from('operacoes').insert(obj); 
        if (error) throw error;
        
        showToast(id ? 'Operação atualizada com sucesso!' : 'Operação registada!', 'success');
        closeModal('modalOperacao'); 
        loadOperacoes(); 
    } catch(e) {
        showToast('Erro ao guardar: ' + e.message, 'error');
    } finally {
        btn.textContent = originalText; btn.disabled = false;
    }
  }
  
  async function saveOperacaoAndGenerateParcelas() { 
    const btn = document.getElementById('btnSaveOpParcelas');
    const originalText = btn.textContent;
    btn.textContent = 'A Gerar...'; btn.disabled = true;

    try {
        const vAprov = unmaskMoney(document.getElementById('opValorAprov').value); 
        const vSolic = unmaskMoney(document.getElementById('opValorSolic').value); 
        const valor = vAprov || vSolic || 0; 
        const taxa = parseFloat(document.getElementById('opTaxa').value) || 0; 
        const nparc = parseInt(document.getElementById('opNumParc').value) || 1; 
        
        const taxaDec = taxa / 100;
        const pmt = taxa > 0 ? (valor * taxaDec * Math.pow(1 + taxaDec, nparc)) / (Math.pow(1 + taxaDec, nparc) - 1) : valor / nparc; 
        
        const obj = { 
          empresa_id: EMPRESA_ID, 
          numero_contrato: document.getElementById('opContrato').value, 
          cliente_id: document.getElementById('opCliente').value || null, 
          avalista_id: document.getElementById('opAvalista').value || null, 
          micro_negocio_id: document.getElementById('opNegocio').value || null, 
          valor_solicitado: vSolic, 
          valor_aprovado: vAprov, 
          taxa_juros: taxa, 
          num_parcelas: nparc, 
          valor_parcela: Math.round(pmt * 100) / 100, 
          data_contratacao: document.getElementById('opDataContr').value || null, 
          data_primeiro_vencimento: document.getElementById('opDataVenc').value || null, 
          finalidade: document.getElementById('opFinalidade').value, 
          garantia: document.getElementById('opGarantia').value, 
          status: document.getElementById('opStatus').value,
          observacoes: document.getElementById('opObs').value, 
        }; 
        
        const { data: inserted, error } = await sb.from('operacoes').insert(obj).select().single(); 
        if (error) throw error;
        
        await generateParcelsForOp(inserted); 
        showToast('Operação salva e parcelas geradas!', 'success'); 
        closeModal('modalOperacao'); 
        loadOperacoes(); 
    } catch(e) {
        showToast('Erro ao gerar: ' + e.message, 'error');
    } finally {
        btn.textContent = originalText; btn.disabled = false;
    }
  }
  
  async function generateParcelsForOp(op) { 
    const valor = op.valor_aprovado || op.valor_solicitado; 
    const taxa = op.taxa_juros / 100; 
    const n = op.num_parcelas; 
    const pmt = taxa > 0 ? (valor * taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1) : valor / n; 
    let saldo = valor; 
    const baseDate = new Date(op.data_primeiro_vencimento || op.data_contratacao); 
    const parcelas = []; 
    
    for (let i = 1; i <= n; i++) { 
      const vencDate = new Date(baseDate); 
      vencDate.setMonth(vencDate.getMonth() + (i - 1)); 
      const juros = saldo * taxa; 
      const principal = pmt - juros; 
      saldo -= principal; 
      
      parcelas.push({ 
        empresa_id: EMPRESA_ID, 
        operacao_id: op.id, 
        numero_parcela: i, 
        valor_principal: Math.round(principal * 100) / 100, 
        valor_juros: Math.round(juros * 100) / 100, 
        valor_total: Math.round(pmt * 100) / 100, 
        data_vencimento: vencDate.toISOString().slice(0, 10), 
        status: 'pendente', 
      }); 
    } 
    await sb.from('parcelas').insert(parcelas); 
  }
  
  async function gerarParcelas(opId) { 
    if (!confirm('Gerar parcelas? Esta ação não pode ser desfeita.')) return; 
    try {
        const { data: op, error: e1 } = await sb.from('operacoes').select('*').eq('id', opId).eq('empresa_id', EMPRESA_ID).single(); 
        if (e1) throw e1;
        
        const { count, error: e2 } = await sb.from('parcelas').select('id', { count: 'exact', head: true }).eq('operacao_id', opId).eq('empresa_id', EMPRESA_ID); 
        if (e2) throw e2;

        if (count > 0) { showToast('Atenção: Já existem parcelas geradas para esta operação.', 'warning'); return; } 
        
        await generateParcelsForOp(op); 
        showToast('Parcelas geradas com sucesso!', 'success'); 
    } catch(e) {
        showToast('Erro ao gerar: ' + e.message, 'error');
    }
  }
  
  async function deleteOperacao(id) { 
    if (!confirm('Excluir operação e as suas respetivas parcelas? Esta ação é irreversível!')) return; 
    try {
        await sb.from('parcelas').delete().eq('operacao_id', id).eq('empresa_id', EMPRESA_ID); 
        await sb.from('operacoes').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); 
        showToast('Operação apagada.', 'success');
        loadOperacoes(); 
    } catch(e) {
        showToast('Erro ao apagar: ' + e.message, 'error');
    }
  }

  // =============================================
  // PARCELAS
  // =============================================
  async function loadParcelas() { 
    const searchStr = (document.getElementById('filterParcelaBusca')?.value || '').trim().toLowerCase(); 
    // sem filtro: mostra atrasadas e pendentes 
    const status = document.getElementById('filterParcelaStatus')?.value; 
    const date = document.getElementById('filterParcelaDate')?.value; 
    
    let q = sb.from('parcelas').select('*,operacao:operacoes(numero_contrato, cliente:clientes(nome,cpf))').eq('empresa_id', EMPRESA_ID).order('data_vencimento'); 
    if (status) q = q.eq('status', status); 
    if (date) q = q.eq('data_vencimento', date); 
    if (!searchStr && !status && !date) q = q.in('status', ['atrasada','pendente']).limit(200);
    let { data } = await q; 
    
    const today = new Date().toISOString().slice(0, 10); 
    const overdue = (data || []).filter(p => p.status === 'pendente' && p.data_vencimento < today); 
    for (const p of overdue) { 
      await sb.from('parcelas').update({ status: 'atrasada' }).eq('id', p.id).eq('empresa_id', EMPRESA_ID); 
      p.status = 'atrasada'; 
    } 
    
    if (searchStr) { data = (data||[]).filter(p => { const nome=(p.operacao?.cliente?.nome||'').toLowerCase(); const cpf=(p.operacao?.cliente?.cpf||''); return nome.includes(searchStr)||cpf.includes(searchStr); }); }
    if (!data || data.length === 0) { document.getElementById('tblParcelas').innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma parcela encontrada.</td></tr>'; return; } 
    
    const todayStr = new Date().toISOString().slice(0,10);
    document.getElementById('tblParcelas').innerHTML = data.map(p => {
      const isAtrasada = p.status === 'atrasada';
      const isHoje = p.data_vencimento === todayStr && p.status === 'pendente';
      const rowStyle = isAtrasada ? 'background:rgba(229,57,53,0.03);' : isHoje ? 'background:rgba(255,171,0,0.03);' : '';
      const dias = isAtrasada ? Math.floor((new Date() - new Date(p.data_vencimento+'T00:00:00')) / 86400000) : 0;
      return `<tr style="${rowStyle}">
        <td><strong>${p.operacao?.cliente?.nome || '-'}</strong></td>
        <td style="font-family:'Outfit',sans-serif;">${p.operacao?.numero_contrato || '-'}</td>
        <td><span style="font-family:'Outfit',sans-serif;font-weight:700;">${p.numero_parcela}ª</span></td>
        <td style="font-family:'Outfit',sans-serif;font-weight:700;">${fmt(p.valor_total)}</td>
        <td>${isAtrasada ? `<span style="color:var(--danger);font-weight:700;">${fmtDate(p.data_vencimento)} <span style="font-size:10px;background:var(--danger-bg);color:var(--danger-text);padding:1px 6px;border-radius:100px;">${dias}d atraso</span></span>` : isHoje ? `<span style="color:var(--warning-text);font-weight:700;">Hoje ⏰</span>` : fmtDate(p.data_vencimento)}</td>
        <td>${fmtDate(p.data_pagamento)}</td>
        <td>${p.valor_pago ? fmt(p.valor_pago) : '-'}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${p.status !== 'paga' ? `<button class="btn btn-success btn-sm" onclick="openPagarParcela('${p.id}', ${p.valor_total})">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 13l4 4L19 7"/></svg>
          Pagar
        </button>` : '<span style="color:var(--success-text);font-size:12px;font-weight:700;">✓ Pago</span>'}</td>
      </tr>`;
    }).join(''); 
  }
  
  function openPagarParcela(id, valor) { 
    document.getElementById('ppId').value = id; 
    document.getElementById('ppData').value = new Date().toISOString().slice(0, 10); 
    document.getElementById('ppValor').value = toMoneyInput(valor); 
    document.getElementById('ppDesconto').value = toMoneyInput(0); 
    document.getElementById('ppObs').value = ''; 
    openModal('modalPagarParcela'); 
  }
  
  async function pagarParcela() { 
    const id = document.getElementById('ppId').value; 
    const btn = document.getElementById('btnConfirmPagarParcela');
    btn.textContent = 'A processar...'; btn.disabled = true;

    try {
        const obj = { 
          data_pagamento: document.getElementById('ppData').value, 
          valor_pago: unmaskMoney(document.getElementById('ppValor').value), 
          forma_pagamento: document.getElementById('ppForma').value, 
          valor_desconto: unmaskMoney(document.getElementById('ppDesconto').value), 
          observacoes: document.getElementById('ppObs').value, 
          status: 'paga', 
        }; 
        await sb.from('parcelas').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID); 
        showToast('Pagamento confirmado com sucesso!', 'success');
        closeModal('modalPagarParcela'); 
        loadParcelas(); 
    } catch (e) {
        showToast('Erro ao confirmar pagamento: ' + e.message, 'error');
    } finally {
        btn.textContent = 'Confirmar Recebimento'; btn.disabled = false;
    }
  }

  // =============================================
  // INADIMPLÊNCIA (AUTOMATIZADA E COM ETIQUETAS KORBAN)
  // =============================================
  let inadCacheAgrupado = {};

  async function checkInadimplencia(event) { 
    const btn = event?.currentTarget;
    if(btn) { btn.textContent = 'A sincronizar...'; btn.disabled = true; }

    try {
        const today = new Date().toISOString().slice(0, 10);

        // 1) Marcar pendentes vencidas como atrasadas
        const { data: pendentes } = await sb.from('parcelas').select('id').eq('status', 'pendente').eq('empresa_id', EMPRESA_ID).lt('data_vencimento', today);
        if (pendentes && pendentes.length > 0) {
            const ids = pendentes.map(p => p.id);
            await sb.from('parcelas').update({ status: 'atrasada' }).in('id', ids).eq('empresa_id', EMPRESA_ID);
        }

        // 2) Para cada atrasada, criar/atualizar registo de inadimplência individualmente
        const { data: atrasadas } = await sb.from('parcelas')
            .select('*,operacao:operacoes(id,numero_contrato,cliente_id)')
            .eq('status', 'atrasada').eq('empresa_id', EMPRESA_ID);

        let erroLoop = 0;
        for (const p of (atrasadas || [])) {
            try {
                const dias = Math.max(0, Math.floor((new Date() - new Date(p.data_vencimento + 'T12:00:00')) / 86400000));
                const multa = (p.valor_total || 0) * 2 / 100;
                const mora  = (p.valor_total || 0) * 0.0333 / 100 * dias;
                const total = (p.valor_total || 0) + multa + mora;
                const { data: existente } = await sb.from('inadimplencia').select('id,status').eq('parcela_id', p.id).eq('empresa_id', EMPRESA_ID);
                if (existente && existente.length > 0) {
                    if (existente[0].status === 'pendente') {
                        await sb.from('inadimplencia').update({
                            dias_atraso: dias, valor_multa: Math.round(multa*100)/100,
                            valor_mora: Math.round(mora*100)/100, valor_total_devido: Math.round(total*100)/100
                        }).eq('id', existente[0].id).eq('empresa_id', EMPRESA_ID);
                    }
                } else {
                    await sb.from('inadimplencia').insert({
                        empresa_id: EMPRESA_ID, operacao_id: p.operacao?.id || p.operacao_id || null,
                        parcela_id: p.id, cliente_id: p.operacao?.cliente_id || null,
                        dias_atraso: dias, valor_devido: p.valor_total || 0,
                        valor_multa: Math.round(multa*100)/100, valor_mora: Math.round(mora*100)/100,
                        valor_total_devido: Math.round(total*100)/100, status: 'pendente'
                    });
                }
            } catch(eInner) { erroLoop++; console.warn('[Sync] parcela', p.id, eInner.message); }
        }

        // 3) Resolver pagas automaticamente
        const { data: pagas } = await sb.from('parcelas').select('id').eq('status', 'paga').eq('empresa_id', EMPRESA_ID);
        if (pagas && pagas.length > 0) {
            const idsPagas = pagas.map(p => p.id);
            await sb.from('inadimplencia').update({ status: 'resolvido' }).in('parcela_id', idsPagas).eq('status', 'pendente').eq('empresa_id', EMPRESA_ID);
        }

        if (erroLoop > 0) showToast('⚠️ Sincronizado com ' + erroLoop + ' aviso(s). Ver F12.', 'warning');
        else showToast('✅ Inadimplência Sincronizada!', 'success');

    } catch (e) {
        showToast('Erro ao sincronizar: ' + e.message, 'error');
        console.error('[checkInadimplencia]', e);
    } finally {
        // SEMPRE recarregar a tabela, mesmo em caso de erro parcial
        try { await loadInadimplencia(); } catch(e2) { console.error('[loadInad]', e2); }
        if(btn) { btn.innerHTML = '<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Atualizar Sistema'; btn.disabled = false; }
    }
  }

  async function loadInadimplencia() {
    const statusFilter = document.getElementById('filterInadStatus')?.value;
    const hoje = new Date().toISOString().slice(0, 10);

    // 1) Buscar todos os registos da tabela inadimplencia (importados / sincronizados)
    const { data: inadData } = await sb.from('inadimplencia')
      .select('*, cliente:clientes(*), operacao:operacoes(numero_contrato), parcela:parcelas(numero_parcela, data_vencimento)')
      .eq('empresa_id', EMPRESA_ID)
      .order('dias_atraso', { ascending: false });

    // Mapear por parcela_id para merge
    const inadByParcela = {};
    (inadData || []).forEach(r => { if (r.parcela_id) inadByParcela[r.parcela_id] = r; });

    // 2) Buscar TODAS as parcelas atrasadas directamente (incluindo observacoes da operacao)
    const { data: parcelasAtrasadas } = await sb.from('parcelas')
      .select('*, operacao:operacoes(id, numero_contrato, cliente_id, observacoes, cliente:clientes(*))')
      .eq('status', 'atrasada')
      .eq('empresa_id', EMPRESA_ID);

    // Marcar como atrasada as pendentes vencidas (lazy update)
    const { data: pendentesVencidas } = await sb.from('parcelas')
      .select('id')
      .eq('status', 'pendente')
      .eq('empresa_id', EMPRESA_ID)
      .lt('data_vencimento', hoje);
    if (pendentesVencidas && pendentesVencidas.length > 0) {
      const ids = pendentesVencidas.map(p => p.id);
      await sb.from('parcelas').update({ status: 'atrasada' }).in('id', ids).eq('empresa_id', EMPRESA_ID);
      const { data: extra } = await sb.from('parcelas')
        .select('*, operacao:operacoes(id, numero_contrato, cliente_id, observacoes, cliente:clientes(*))')
        .in('id', ids)
        .eq('empresa_id', EMPRESA_ID);
      (extra || []).forEach(p => { if (!parcelasAtrasadas.find(x => x.id === p.id)) parcelasAtrasadas.push(p); });
    }

    // Helper: extrai especialista das observacoes da operacao (importacoes via planilha)
    function _espFromObs(obs) {
      if (!obs) return null;
      const m = obs.match(/Especialista:\s*([^|\n\r]+)/i);
      return m ? m[1].trim() : null;
    }

    // 3) Construir visao unificada
    inadCacheAgrupado = {};

    for (const p of (parcelasAtrasadas || [])) {
      const inadRec = inadByParcela[p.id];
      const cli = p.operacao?.cliente || { nome: 'Sem cliente', cpf: '\u2014', celular: '', telefone: '' };
      const clienteId = p.operacao?.cliente_id || 'sem_cliente_' + p.id;
      const dias = Math.max(0, Math.floor((new Date() - new Date(p.data_vencimento + 'T12:00:00')) / 86400000));
      const multa = (p.valor_total || 0) * 2 / 100;
      const mora  = (p.valor_total || 0) * 0.0333 / 100 * dias;
      const total = (p.valor_total || 0) + multa + mora;

      const statusRec = inadRec ? inadRec.status : 'pendente';
      if (statusFilter === 'pendente'  && statusRec !== 'pendente')  continue;
      if (statusFilter === 'resolvido' && statusRec !== 'resolvido') continue;

      // Especialista: inadimplencia.especialista > observacoes da operacao > '-'
      const espObs = _espFromObs(p.operacao?.observacoes);
      const especialistaParcela = (inadRec?.especialista && inadRec.especialista !== '-')
        ? inadRec.especialista
        : (espObs || '-');

      if (!inadCacheAgrupado[clienteId]) {
        inadCacheAgrupado[clienteId] = { cliente: cli, total: 0, itens: [], especialista: especialistaParcela };
      }

      if (statusRec === 'pendente') inadCacheAgrupado[clienteId].total += Math.round(total * 100) / 100;
      if (especialistaParcela !== '-') inadCacheAgrupado[clienteId].especialista = especialistaParcela;

      inadCacheAgrupado[clienteId].itens.push({
        id:               inadRec?.id || null,
        parcela_id:       p.id,
        status:           statusRec,
        dias_atraso:      inadRec?.dias_atraso ?? dias,
        valor_total_devido: inadRec ? inadRec.valor_total_devido : Math.round(total * 100) / 100,
        operacao:         { numero_contrato: p.operacao?.numero_contrato || '-' },
        parcela:          { numero_parcela: p.numero_parcela, data_vencimento: p.data_vencimento },
        _semRegistro:     !inadRec   // marcador: ainda não entrou na tabela inadimplencia
      });
    }

    // 4) Renderizar
    let html = '';
    for (let cid in inadCacheAgrupado) {
      const g = inadCacheAgrupado[cid];
      const pendentesCount = g.itens.filter(i => i.status === 'pendente').length;

      html += `
        <tr style="background:${pendentesCount > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'};font-weight:600;">
          <td>${g.cliente.nome}</td>
          <td>${g.especialista && g.especialista !== '-'
            ? `<span style="background:rgba(255,87,34,0.1);color:var(--primary);padding:2px 9px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(255,87,34,0.2);">${g.especialista}</span>`
            : '<span style="color:var(--text-light);">—</span>'}</td>
          <td>${g.cliente.cpf || '—'}</td>
          <td><span class="badge ${pendentesCount > 0 ? 'badge-danger' : 'badge-success'}">${pendentesCount > 0 ? pendentesCount + ' em atraso' : 'Resolvido'}</span></td>
          <td style="color:${pendentesCount > 0 ? 'var(--danger-text)' : 'var(--success-text)'}; font-weight:700;">${fmt(g.total)}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-outline btn-sm" onclick="toggleDetInad('${cid}')">Ver Detalhes</button>
              <button class="btn btn-primary btn-sm" onclick="openCobrancaCliente('${cid}')">Cobrar</button>
            </div>
          </td>
        </tr>
        <tr id="inad-det-${cid}" style="display:none;">
          <td colspan="6" style="padding:0;">
            <table style="width:100%;background:var(--surface-2);border-left:4px solid ${pendentesCount > 0 ? 'var(--warning)' : 'var(--success)'};margin:0;">
              <thead><tr>
                <th>Contrato</th><th>Parcela</th><th>Vencimento</th>
                <th>Dias Atraso</th><th>Valor Atualizado</th><th>Situação</th>
              </tr></thead>
              <tbody>
                ${g.itens.map(i => `
                  <tr>
                    <td>${i.operacao?.numero_contrato || '-'}</td>
                    <td>Nº ${i.parcela?.numero_parcela || '-'}</td>
                    <td>${fmtDate(i.parcela?.data_vencimento)}</td>
                    <td><span style="font-weight:700;color:var(--danger-text);">${i.dias_atraso}d</span></td>
                    <td style="font-weight:700;">${fmt(i.valor_total_devido)}</td>
                    <td>
                      ${i.id
                        ? `<div style="display:flex;gap:6px;">
                            <span onclick="alterarStatusInad('${i.id}','pendente')" class="badge badge-btn ${i.status==='pendente'?'badge-danger':'badge-neutral'}" title="Pendente">Pendente</span>
                            <span onclick="alterarStatusInad('${i.id}','resolvido')" class="badge badge-btn ${i.status==='resolvido'?'badge-success':'badge-neutral'}" title="Resolvido">Resolvido</span>
                           </div>`
                        : `<span class="badge badge-warning" title="Clique em Atualizar Sistema para registar">⚠️ Não registado</span>`
                      }
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </td>
        </tr>`;
    }

    document.getElementById('tblInadimplencia').innerHTML = html ||
      '<tr><td colspan="6" class="empty-state">✅ Nenhuma parcela em atraso encontrada.</td></tr>';
  } 
  
  function toggleDetInad(cid) { const el = document.getElementById(`inad-det-${cid}`); el.style.display = el.style.display === 'none' ? 'table-row' : 'none'; } 
  
  async function alterarStatusInad(id, novoStatus) { 
      await sb.from('inadimplencia').update({ status: novoStatus }).eq('id', id).eq('empresa_id', EMPRESA_ID); 
      loadInadimplencia(); 
  }

  function printInadimplenciaGeral() { if (Object.keys(inadCacheAgrupado).length === 0) { showToast('Nenhum dado', 'info'); return; } let h = ''; let t = 0; for (let c in inadCacheAgrupado) { const g = inadCacheAgrupado[c]; t += g.total; h += `<div><h3>${g.cliente.nome}</h3><table><tr><th>Parcela</th><th>Venc</th><th>Dias</th><th>Total</th></tr>${g.itens.map(i=>`<tr><td>${i.parcela?.numero_parcela}</td><td>${fmtDate(i.parcela?.data_vencimento)}</td><td>${i.dias_atraso}</td><td>${fmt(i.valor_total_devido)}</td></tr>`).join('')}</table></div>`; } const w = window.open('','_blank'); w.document.write(`<html><head><style>body{font-family:sans-serif;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ccc; padding:8px;}</style></head><body><h1>Relatório de Inadimplência</h1>${h}<h2>Total Geral (Filtro Atual): ${fmt(t)}</h2></body></html>`); w.document.close(); setTimeout(()=>w.print(),1000); }
  async function openCobrancaCliente(cid) { const g = inadCacheAgrupado[cid]; document.getElementById('cobClienteId').value = cid; document.getElementById('cobTelefone').value = g.cliente.celular || g.cliente.telefone || ''; document.getElementById('cobNomeClienteTitle').textContent = g.cliente.nome; document.getElementById('cobData').value = new Date().toISOString().slice(0, 10); document.getElementById('cobTipo').value = 'WhatsApp'; document.getElementById('cobResultado').value = ''; await carregarHistoricoCobranca(cid); openModal('modalCobranca'); }
  function gerarMensagemCobranca() { const cid = document.getElementById('cobClienteId').value; const g = inadCacheAgrupado[cid]; if(!g) return; const n = g.cliente.nome.split(' ')[0]; document.getElementById('cobResultado').value = `Olá ${n}, tudo bem? Identificamos que consta um atraso no nosso sistema no valor total de ${fmt(g.total)}. Por favor, entre em contato para regularizarmos a situação.`; }
  function enviarWhatsApp() { let p = document.getElementById('cobTelefone').value.replace(/\D/g, ''); if (p.length === 10 || p.length === 11) p = '55' + p; const m = document.getElementById('cobResultado').value; if(!m) return; window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(m)}`, '_blank'); }
  async function saveCobranca() { const cid = document.getElementById('cobClienteId').value; const obj = { empresa_id: EMPRESA_ID, cliente_id: cid, data_registro: document.getElementById('cobData').value, tipo: document.getElementById('cobTipo').value, mensagem: document.getElementById('cobResultado').value }; if(!obj.mensagem) return; await sb.from('historico_cobrancas').insert(obj); const g = inadCacheAgrupado[cid]; const ids = g.itens.map(i => i.id); await sb.from('inadimplencia').update({ data_contato: obj.data_registro }).in('id', ids).eq('empresa_id', EMPRESA_ID); showToast('Salvo!', 'success'); document.getElementById('cobResultado').value = ''; carregarHistoricoCobranca(cid); }
  async function carregarHistoricoCobranca(cid) { const { data } = await sb.from('historico_cobrancas').select('*').eq('cliente_id', cid).eq('empresa_id', EMPRESA_ID).order('created_at', { ascending: false }); document.getElementById('listHistorico').innerHTML = (data||[]).map(h => `<div style="background:#f1f5f9; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>${fmtDate(h.data_registro)} - ${h.tipo}</strong><br>${h.mensagem}</div>`).join('') || 'Nenhum histórico.'; }

  // =============================================
  // RENOVACOES
  // =============================================
  async function loadRenovacoes() { 
    const { data } = await sb.from('renovacoes').select('*,cliente:clientes(nome),op_orig:operacoes!operacao_original_id(numero_contrato)').eq('empresa_id', EMPRESA_ID).order('created_at', { ascending: false }); 
    document.getElementById('tblRenovacoes').innerHTML = (data || []).map(r => `
      <tr>
        <td>${r.cliente?.nome || '-'}</td>
        <td>${r.op_orig?.numero_contrato || '-'}</td>
        <td>${fmt(r.saldo_devedor)}</td>
        <td>${fmt(r.valor_novo_emprestimo)}</td>
        <td>${r.aprovado ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-danger">Não</span>'}</td>
        <td>${fmtDate(r.data_renovacao)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteRenovacao('${r.id}')">Excluir</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty-state">Nenhuma renovação registada</td></tr>'; 
  }
  
  async function openRenovacaoModal() { 
    const { data: ops } = await sb.from('operacoes').select('id,numero_contrato,cliente_id').in('status', ['em_andamento', 'liberada']).eq('empresa_id', EMPRESA_ID); 
    document.getElementById('rnOperacao').innerHTML = '<option value="">Selecione</option>' + (ops || []).map(o => `<option value="${o.id}" data-cid="${o.cliente_id}">${o.numero_contrato}</option>`).join(''); 
    document.getElementById('rnSaldo').value = ''; 
    document.getElementById('rnNovoValor').value = ''; 
    document.getElementById('rnAprovado').value = 'false'; 
    document.getElementById('rnMotivo').value = ''; 
    openModal('modalRenovacao'); 
  }
  
  async function loadSaldoDevedor() { 
    const opId = document.getElementById('rnOperacao').value; 
    if (!opId) return; 
    const { data: parcelas } = await sb.from('parcelas').select('valor_total,valor_pago,status').eq('operacao_id', opId).eq('empresa_id', EMPRESA_ID); 
    const saldo = (parcelas || []).filter(p => p.status !== 'paga').reduce((s, p) => s + Number(p.valor_total || 0), 0); 
    document.getElementById('rnSaldo').value = toMoneyInput(Math.round(saldo * 100) / 100); 
  }
  
  async function saveRenovacao() { 
    const opId = document.getElementById('rnOperacao').value; 
    const sel = document.getElementById('rnOperacao'); 
    const cid = sel.options[sel.selectedIndex]?.dataset?.cid; 
    const obj = { 
      empresa_id: EMPRESA_ID, 
      operacao_original_id: opId || null, 
      cliente_id: cid || null, 
      saldo_devedor: unmaskMoney(document.getElementById('rnSaldo').value), 
      valor_novo_emprestimo: unmaskMoney(document.getElementById('rnNovoValor').value), 
      aprovado: document.getElementById('rnAprovado').value === 'true', 
      motivo: document.getElementById('rnMotivo').value, 
    }; 
    await sb.from('renovacoes').insert(obj); 
    closeModal('modalRenovacao'); loadRenovacoes(); 
  }
  
  async function deleteRenovacao(id) { if (!confirm('Excluir?')) return; await sb.from('renovacoes').delete().eq('id', id).eq('empresa_id', EMPRESA_ID); loadRenovacoes(); }

  // =============================================
  // RELATORIOS E EXPORTAR
  // =============================================
  function switchReportTab(btn, tabId) { 
    document.querySelectorAll('#page-relatorios .tab').forEach(t => t.classList.remove('active')); 
    btn.classList.add('active'); 
    ['repResumo', 'repCarteira', 'repExportar'].forEach(id => { document.getElementById(id).style.display = id === tabId ? 'block' : 'none'; }); 
    if (tabId === 'repCarteira') loadCarteira(); 
  }
  
  async function loadRelatorios() { 
    const [oRes, pRes] = await Promise.all([ sb.from('operacoes').select('*').eq('empresa_id', EMPRESA_ID), sb.from('parcelas').select('*').eq('empresa_id', EMPRESA_ID), ]); 
    const ops = oRes.data || []; const parcs = pRes.data || []; 
    const totalDesembolsado = ops.filter(o => ['liberada', 'em_andamento', 'quitada'].includes(o.status)).reduce((s, o) => s + Number(o.valor_aprovado || o.valor_solicitado || 0), 0); 
    const totalRecebido = parcs.filter(p => p.status === 'paga').reduce((s, p) => s + Number(p.valor_pago || 0), 0); 
    const totalAtrasado = parcs.filter(p => p.status === 'atrasada').reduce((s, p) => s + Number(p.valor_total || 0), 0); 
    const taxaInadimplencia = ops.length > 0 ? (ops.filter(o => o.status === 'inadimplente').length / ops.length * 100).toFixed(1) : 0; 
    
    document.getElementById('reportStats').innerHTML = `
      <div class="stat-card accent"><div class="label">Desembolsado</div><div class="value">${fmt(totalDesembolsado)}</div></div>
      <div class="stat-card success"><div class="label">Recebido</div><div class="value">${fmt(totalRecebido)}</div></div>
      <div class="stat-card danger"><div class="label">Atrasado</div><div class="value">${fmt(totalAtrasado)}</div></div>
      <div class="stat-card info"><div class="label">Taxa Inadimplência</div><div class="value">${taxaInadimplencia}%</div></div>
    `; 
    
    const statusCount = {}; 
    ops.forEach(o => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; }); 
    const colors = { em_analise: '#3b82f6', aprovada: '#10b981', liberada: '#0ea5e9', em_andamento: '#ea580c', quitada: '#059669', inadimplente: '#ef4444' }; 
    const maxCount = Math.max(...Object.values(statusCount), 1); 
    
    document.getElementById('reportChart').innerHTML = `
      <div style="display:flex;gap:15px;align-items:end;height:200px;padding:20px 0;">
        ${Object.entries(statusCount).map(([s, c]) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
            <span style="font-size:14px;font-weight:700;">${c}</span>
            <div style="width:100%;max-width:60px;height:${(c / maxCount) * 150}px;background:${colors[s] || '#cbd5e1'};border-radius:6px 6px 0 0;"></div>
            <span style="font-size:10px;color:var(--text-secondary);text-align:center;">${s.replace(/_/g, ' ')}</span>
          </div>
        `).join('')}
      </div>`; 
  }
  
  async function loadCarteira() { 
    const { data: ops } = await sb.from('operacoes').select('*,cliente:clientes(nome)').in('status', ['em_andamento', 'liberada']).eq('empresa_id', EMPRESA_ID); 
    const rows = []; 
    for (const o of (ops || [])) { 
      const { data: parcs } = await sb.from('parcelas').select('*').eq('operacao_id', o.id).eq('empresa_id', EMPRESA_ID); 
      const pagas = (parcs || []).filter(p => p.status === 'paga').length; 
      const saldo = (parcs || []).filter(p => p.status !== 'paga').reduce((s, p) => s + Number(p.valor_total || 0), 0); 
      rows.push({ ...o, pagas, total: (parcs || []).length, saldo }); 
    } 
    document.getElementById('tblCarteira').innerHTML = rows.map(r => `
      <tr>
        <td>${r.cliente?.nome || '-'}</td>
        <td>${r.numero_contrato || '-'}</td>
        <td>${fmt(r.valor_aprovado || r.valor_solicitado)}</td>
        <td>${r.pagas}/${r.total}</td>
        <td>${fmt(r.saldo)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty-state">Nenhuma operação ativa</td></tr>'; 
  }
  
  async function exportCSV(table) { 
    const { data, error } = await sb.from(table).select('*').eq('empresa_id', EMPRESA_ID); 
    if (error || !data || data.length === 0) { showToast('Sem dados para exportar', 'error'); return; } 
    const headers = Object.keys(data[0]); 
    const csv = [headers.join(';'), ...data.map(row => headers.map(h => { 
      let val = row[h] ?? ''; 
      if (typeof val === 'string' && (val.includes(';') || val.includes('"') || val.includes('\n'))) { val = '"' + val.replace(/"/g, '""') + '"'; } 
      return val; 
    }).join(';'))].join('\n'); 
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `${table}_${new Date().toISOString().slice(0, 10)}.csv`; 
    a.click(); 
    URL.revokeObjectURL(url); 
    showToast(`Ficheiro Excel transferido!`, 'success'); 
  }


  // =============================================
  // SISTEMA DE TAREFAS
  // =============================================

  // ── ALERT DROPDOWN (inadimplência / vencimentos) ──
  let alertDropOpen = false;
  function toggleAlertDropdown() {
    const dd  = document.getElementById('alertDropdown');
    const btn = document.getElementById('btnAlertSino');
    alertDropOpen = !alertDropOpen;
    dd.style.display = alertDropOpen ? 'block' : 'none';
    if (alertDropOpen && btn) btn.style.background = 'var(--surface-2)';
    else if (btn) btn.style.background = 'var(--surface)';
  }
  document.addEventListener('click', function(e) {
    const btn = document.getElementById('btnAlertSino');
    const dd  = document.getElementById('alertDropdown');
    if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = 'none';
      alertDropOpen = false;
    }
  });

  let tarefaDropOpen = false;

  function toggleTarefaDropdown() {
    const dd = document.getElementById('notifDropdown');
    tarefaDropOpen = !tarefaDropOpen;
    dd.style.display = tarefaDropOpen ? 'block' : 'none';
    if (tarefaDropOpen) loadTarefaDropdown();
  }
  document.addEventListener('click', function(e) {
    const btn = document.getElementById('btnTarefaSino');
    const dd  = document.getElementById('notifDropdown');
    if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = 'none';
      tarefaDropOpen = false;
    }
  });

  async function loadTarefaDropdown() {
    const { data } = await sb.from('tarefas')
      .select('*,cliente:clientes(nome)')
      .eq('empresa_id', EMPRESA_ID)
      .neq('status', 'concluida')
      .order('prazo', { ascending: true })
      .limit(8);
    const list = document.getElementById('notifDropList');
    const pendentes = (data||[]).length;
    const badge = document.getElementById('sinoBadge');
    if (badge) { badge.textContent = pendentes; badge.style.display = pendentes > 0 ? 'flex' : 'none'; }
    const tb = document.getElementById('tarefaBadge');
    if (tb) { tb.textContent = pendentes; tb.style.display = pendentes > 0 ? 'inline' : 'none'; }
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Nenhuma tarefa pendente</div>';
      return;
    }
    const priorSvg = {
      urgente: '<svg width="14" height="14" fill="none" stroke="#e53935" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
      alta:    '<svg width="14" height="14" fill="none" stroke="#ff8f00" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 15l7-7 7 7"/></svg>',
      normal:  '<svg width="14" height="14" fill="none" stroke="#2979ff" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>',
    };
    list.innerHTML = data.map(t => `
      <div class="notif-drop-item" onclick="navigate('tarefas');toggleTarefaDropdown();">
        <div style="flex-shrink:0;margin-top:2px;">${priorSvg[t.prioridade]||priorSvg.normal}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.titulo}</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:3px;display:flex;align-items:center;gap:5px;">
            ${t.prazo ? `<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg> ${new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Sem prazo'}
            ${t.cliente?.nome ? `<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> ${t.cliente.nome}` : ''}
          </div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px;background:${t.status==='em_andamento'?'rgba(41,121,255,0.12)':'rgba(255,171,0,0.12)'};color:${t.status==='em_andamento'?'var(--info-text)':'var(--warning-text)'};">${t.status==='em_andamento'?'Em andamento':'Pendente'}</span>
      </div>`).join('');
  }

  async function loadTarefas() {
    const status    = document.getElementById('tarefaFiltroStatus')?.value || '';
    const prioridade = document.getElementById('tarefaFiltroPrioridade')?.value || '';
    let query = sb.from('tarefas').select('*,cliente:clientes(nome)').eq('empresa_id', EMPRESA_ID).order('prazo', { ascending: true });
    if (status)     query = query.eq('status', status);
    if (prioridade) query = query.eq('prioridade', prioridade);
    const { data } = await query.limit(100);
    const listEl = document.getElementById('tarefaList');
    if (!listEl) return;
    await atualizarBadgeTarefa();
    if (!data || data.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:50px;color:var(--text-light);font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Nenhuma tarefa encontrada</div>';
      return;
    }
    const priorBadge = {
      urgente: '<span class="badge badge-danger"  style="font-size:9px;">URGENTE</span>',
      alta:    '<span class="badge badge-warning" style="font-size:9px;">ALTA</span>',
      normal:  ''
    };
    const statusBadge = {
      pendente:     '<span class="badge badge-warning" style="font-size:10px;">Pendente</span>',
      em_andamento: '<span class="badge badge-info"    style="font-size:10px;">Em andamento</span>',
      concluida:    '<span class="badge badge-success" style="font-size:10px;">Concluída</span>',
    };
    const statusBg = {
      pendente:     'linear-gradient(135deg,#ff8f00,#ffab00)',
      em_andamento: 'linear-gradient(135deg,#1565c0,#2979ff)',
      concluida:    'linear-gradient(135deg,#00b248,#00c853)',
    };
    const statusSvg = {
      pendente:     '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8v4l2 2"/></svg>',
      em_andamento: '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>',
      concluida:    '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    };
    listEl.innerHTML = data.map(t => {
      const atrasada = t.prazo && t.status !== 'concluida' && new Date(t.prazo + 'T00:00:00') < new Date();
      return `
      <div class="notif-item ${t.status === 'concluida' ? '' : 'nao-lida'} ${t.prioridade === 'urgente' ? 'urgente' : t.prioridade === 'alta' ? 'alta' : ''}">
        <div class="notif-icon" style="background:${statusBg[t.status]||statusBg.pendente};">
          ${statusSvg[t.status]||statusSvg.pendente}
        </div>
        <div class="notif-body">
          <div class="notif-title">${t.titulo} ${priorBadge[t.prioridade]||''} ${statusBadge[t.status]||''}</div>
          ${t.descricao ? `<div class="notif-msg">${t.descricao}</div>` : ''}
          <div class="notif-meta">
            ${t.prazo ? `<span style="display:flex;align-items:center;gap:4px;${atrasada?'color:var(--danger);font-weight:700;':''}"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>${new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}${atrasada ? ' · <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> Atrasada' : ''}</span>` : '<span>Sem prazo</span>'}
            ${t.cliente?.nome ? `<span>·</span><span style="display:flex;align-items:center;gap:4px;"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${t.cliente.nome}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
          ${t.status !== 'concluida' ? `
            <select onchange="updateTarefaStatus('${t.id}', this.value)" class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px;cursor:pointer;">
              <option value="pendente"     ${t.status==='pendente'     ?'selected':''}>Pendente</option>
              <option value="em_andamento" ${t.status==='em_andamento' ?'selected':''}>Em andamento</option>
              <option value="concluida"    ${t.status==='concluida'    ?'selected':''}>Concluída</option>
            </select>` : '<span style="font-size:11px;color:var(--text-light);">Concluída</span>'}
          <button onclick="deleteTarefa('${t.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-light);padding:2px 4px;border-radius:4px;font-size:11px;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-light)'">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  async function atualizarBadgeTarefa() {
    const { count } = await sb.from('tarefas').select('id', { count: 'exact', head: true }).eq('empresa_id', EMPRESA_ID).neq('status', 'concluida');
    const n = count || 0;
    const badge = document.getElementById('sinoBadge');
    if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
    const tb = document.getElementById('tarefaBadge');
    if (tb) { tb.textContent = n; tb.style.display = n > 0 ? 'inline' : 'none'; }
  }

  async function updateTarefaStatus(id, status) {
    await sb.from('tarefas').update({ status }).eq('id', id).eq('empresa_id', EMPRESA_ID);
    loadTarefas();
    atualizarBadgeTarefa();
  }

  async function deleteTarefa(id) {
    await sb.from('tarefas').delete().eq('id', id).eq('empresa_id', EMPRESA_ID);
    loadTarefas();
    atualizarBadgeTarefa();
  }

  async function openNovaTarefaModal() {
    const { data } = await sb.from('clientes').select('id,nome').eq('empresa_id', EMPRESA_ID).eq('status', 'ativo').order('nome');
    const sel = document.getElementById('tarefaClienteId');
    sel.innerHTML = '<option value="">— Nenhum —</option>' + (data||[]).map(cl => `<option value="${cl.id}">${cl.nome}</option>`).join('');
    document.getElementById('tarefaTitulo').value = '';
    document.getElementById('tarefaDescricao').value = '';
    document.getElementById('tarefaPrioridade').value = 'normal';
    document.getElementById('tarefaPrazo').value = '';
    openModal('modalNovaTarefa');
  }

  async function saveTarefa() {
    const titulo = document.getElementById('tarefaTitulo').value.trim();
    if (!titulo) return showToast('Informe o título da tarefa.', 'warning');
    const btn = document.getElementById('btnSaveTarefa');
    btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
      await sb.from('tarefas').insert({
        empresa_id:  EMPRESA_ID,
        titulo,
        descricao:   document.getElementById('tarefaDescricao').value.trim() || null,
        prioridade:  document.getElementById('tarefaPrioridade').value,
        prazo:       document.getElementById('tarefaPrazo').value || null,
        cliente_id:  document.getElementById('tarefaClienteId').value || null,
        status:      'pendente',
      });
      showToast('Tarefa criada!', 'success');
      closeModal('modalNovaTarefa');
      loadTarefas();
      atualizarBadgeTarefa();
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { btn.textContent = 'Salvar Tarefa'; btn.disabled = false; }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'agora mesmo';
    if (m < 60) return m + ' min atrás';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h atrás';
    const d = Math.floor(h / 24);
    if (d < 7)  return d + 'd atrás';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  // =============================================
  // FOTO ATIVIDADE COMERCIAL
  // =============================================
  function previewFotoAtiv(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('previewFotoAtivImg').src = e.target.result;
      document.getElementById('previewFotoAtivDiv').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function previewDoc(inputId, previewDivId) {
    const input = document.getElementById(inputId);
    const div = document.getElementById(previewDivId);
    const file = input?.files?.[0];
    if (!file || !div) return;
    const reader = new FileReader();
    reader.onload = e => {
      div.querySelector('img').src = e.target.result;
      div.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // Cache global de avalistas para o select
  let _avalistasCache = [];

  async function carregarAvalistasSelect() {
    const sel = document.getElementById('cAvSelect');
    if (!sel) return;
    const { data } = await sb.from('avalistas').select('id,nome,cpf,celular,telefone,parentesco,endereco').eq('empresa_id', EMPRESA_ID).order('nome');
    _avalistasCache = data || [];
    sel.innerHTML = '<option value="">— Criar novo ou digitar manualmente —</option>' +
      (_avalistasCache.map(a => `<option value="${a.id}">${a.nome}${a.cpf ? ' — '+a.cpf : ''}</option>`).join(''));
  }

  function preencherAvalistaSelecionado() {
    const sel = document.getElementById('cAvSelect');
    const id = sel?.value;
    if (!id) return;
    const av = _avalistasCache.find(a => a.id === id);
    if (!av) return;
    document.getElementById('cAvId').value = av.id;
    document.getElementById('cAvNome').value = av.nome || '';
    document.getElementById('cAvCpf').value = av.cpf || '';
    document.getElementById('cAvCel').value = av.celular || av.telefone || '';
    document.getElementById('cAvParent').value = av.parentesco || '';
    document.getElementById('cAvEnd').value = av.endereco || '';
  }

  // =============================================
  // WHATSAPP AVALISTA
  // =============================================
  let _waAvalistaAtual = { nome: '', telefone: '' };

  function openWhatsAppAvalista(telefone, nome) {
    _waAvalistaAtual = { nome, telefone };
    document.getElementById('waAvalistaNome').textContent = nome;
    document.getElementById('waAvalistaTelefone').value = telefone;
    document.getElementById('waAvalistaMensagem').value = '';
    document.getElementById('waAvalistaPreview').textContent = '';
    document.getElementById('waAvalistaCharCount').textContent = '0 caracteres';
    openModal('modalWhatsAppAvalista');
  }

  function aplicarModeloAvalista(tipo) {
    const nome = _waAvalistaAtual.nome.split(' ')[0];
    const modelos = {
      saudacao:    `Olá ${nome}! 😊\n\nTudo bem? Sou da equipe MicroCred. Estamos entrando em contato pois você figura como avalista em um contrato conosco.\n\nFique à vontade para nos chamar! 🙏`,
      cobranca:    `Olá ${nome}! 👋\n\nIdentificamos uma pendência no contrato em que você é avalista. Gostaríamos de conversar para encontrar a melhor solução.\n\nPodemos falar agora? ⏰`,
      vencimento:  `Olá ${nome}! 📅\n\nPassamos para lembrá-lo(a) que uma parcela do contrato em que você é avalista está se aproximando do vencimento.\n\nQualquer dúvida, pode nos chamar. 😊`,
      confirmacao: `Olá ${nome}! ✅\n\nConfirmamos o recebimento do pagamento relacionado ao contrato em que você é avalista. Obrigado pela atenção! 🙏`,
    };
    document.getElementById('waAvalistaMensagem').value = modelos[tipo] || '';
    atualizarPreviewAvalistaWA();
  }

  function atualizarPreviewAvalistaWA() {
    const msg = document.getElementById('waAvalistaMensagem').value;
    document.getElementById('waAvalistaPreview').textContent = msg;
    document.getElementById('waAvalistaCharCount').textContent = msg.length + ' caracteres';
  }

  function enviarWhatsAppAvalistaModal() {
    const msg = document.getElementById('waAvalistaMensagem').value.trim();
    let tel = document.getElementById('waAvalistaTelefone').value.replace(/\D/g, '');
    if (!msg) return showToast('Digite uma mensagem antes de enviar.', 'warning');
    if (!tel) return showToast('Número de telefone inválido.', 'error');
    if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
    window.open('https://api.whatsapp.com/send?phone=' + tel + '&text=' + encodeURIComponent(msg), '_blank');
    closeModal('modalWhatsAppAvalista');
  }

  // =============================================
  // LEADS (substitui Avaliação Financeira)
  // =============================================
  let _leadEtiqFiltro = '';

  function filtrarLeadEtiqueta(etiq) {
    _leadEtiqFiltro = etiq;
    loadLeads();
  }

  async function loadLeads() {
    const search = (document.getElementById('searchLeads')?.value || '').trim().toLowerCase();
    let q = sb.from('avaliacoes').select('*').eq('empresa_id', EMPRESA_ID).order('created_at', { ascending: false });
    if (_leadEtiqFiltro) q = q.eq('etiqueta', _leadEtiqFiltro);
    const { data } = await q;
    let leads = data || [];
    if (search) leads = leads.filter(l => (l.nome||'').toLowerCase().includes(search) || (l.telefone||'').includes(search));
    const etiqMap = {
      quente: { label: '🔥 Quente', color: '#bf360c', bg: '#fff0e6', border: '#ffccbc' },
      morno:  { label: '🌡️ Morno', color: '#f57f17', bg: '#fff8e1', border: '#ffecb3' },
      frio:   { label: '❄️ Frio',  color: '#1565c0', bg: '#e3f2fd', border: '#bbdefb' },
      contatado: { label: '✅ Contatado', color: '#2e7d32', bg: '#e8f5e9', border: '#c8e6c9' },
      perdido:   { label: '❌ Perdido',  color: '#880e4f', bg: '#fce4ec', border: '#f8bbd0' },
    };
    document.getElementById('tblLeads').innerHTML = leads.map(l => {
      const etiq = etiqMap[l.etiqueta];
      const etiqBadge = etiq ? `<span style="padding:3px 10px;border-radius:100px;background:${etiq.bg};color:${etiq.color};border:1px solid ${etiq.border};font-size:11px;font-weight:700;">${etiq.label}</span>` : '<span style="color:var(--text-light);font-size:12px;">—</span>';
      const tel = l.telefone || '';
      return `<tr>
        <td><strong>${l.nome||'-'}</strong></td>
        <td>${tel ? `<a href="https://api.whatsapp.com/send?phone=55${tel.replace(/\D/g,'')}" target="_blank" style="color:var(--success-text);font-weight:600;">${tel}</a>` : '-'}</td>
        <td>${l.interesse||l.renda_familiar||'-'}</td>
        <td>${etiqBadge}</td>
        <td style="font-size:12px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.parecer||'-'}</td>
        <td><div class="btn-group">
          ${tel ? `<button class="btn btn-sm" onclick="openWhatsAppLead('${tel}','${(l.nome||'').replace(/'/g,"\\'")}'); " style="background:linear-gradient(135deg,#1a7a4a,#25d366);color:#fff;border:none;gap:4px;" title="WhatsApp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.9 9.9 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M11.998 2C6.473 2 2 6.473 2 11.998c0 1.988.583 3.843 1.59 5.397L2 22l4.766-1.543A9.96 9.96 0 0011.998 22C17.523 22 22 17.527 22 12.002 22 6.473 17.523 2 11.998 2zm0 17.925a7.912 7.912 0 01-4.037-1.105l-.29-.172-2.998.97.998-2.918-.189-.3A7.916 7.916 0 014.075 12c0-4.367 3.556-7.923 7.923-7.923s7.923 3.556 7.923 7.923-3.556 7.925-7.923 7.925z"/></svg>WA
          </button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="editLead('${l.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLead('${l.id}')">Apagar</button>
        </div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-state">Nenhum lead encontrado</td></tr>';
  }

  function openLeadModal(l) {
    document.getElementById('modalAvaliacaoTitle').textContent = l ? 'Editar Lead' : 'Novo Lead';
    document.getElementById('avaliacaoId').value = l?.id || '';
    document.getElementById('avCliente').value = l?.nome || '';
    document.getElementById('avTelefone').value = l?.telefone || '';
    document.getElementById('avRendaFam').value = l?.interesse || l?.renda_familiar || '';
    document.getElementById('avEtiqueta').value = l?.etiqueta || '';
    document.getElementById('avParecer').value = l?.parecer || '';
    openModal('modalAvaliacao');
  }

  async function editLead(id) {
    const { data } = await sb.from('avaliacoes').select('*').eq('id', id).eq('empresa_id', EMPRESA_ID).single();
    if (data) openLeadModal(data);
  }

  async function saveLead() {
    const id = document.getElementById('avaliacaoId').value;
    const btn = document.getElementById('btnSaveAvaliacao');
    const nome = document.getElementById('avCliente').value.trim();
    if (!nome) return showToast('Nome é obrigatório.', 'warning');
    btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
      const obj = {
        empresa_id: EMPRESA_ID,
        nome,
        telefone: document.getElementById('avTelefone').value,
        interesse: document.getElementById('avRendaFam').value,
        etiqueta: document.getElementById('avEtiqueta').value || null,
        parecer: document.getElementById('avParecer').value,
      };
      const { error } = id
        ? await sb.from('avaliacoes').update(obj).eq('id', id).eq('empresa_id', EMPRESA_ID)
        : await sb.from('avaliacoes').insert(obj);
      if (error) throw error;
      showToast(id ? 'Lead atualizado!' : 'Lead salvo com sucesso!', 'success');
      closeModal('modalAvaliacao');
      loadLeads();
    } catch(e) { showToast('Erro: ' + e.message, 'error'); } finally { btn.textContent = 'Salvar Lead'; btn.disabled = false; }
  }

  async function deleteLead(id) {
    if (!confirm('Apagar este lead?')) return;
    await sb.from('avaliacoes').delete().eq('id', id).eq('empresa_id', EMPRESA_ID);
    showToast('Lead apagado.', 'success'); loadLeads();
  }

  function openWhatsAppLead(telefone, nome) { openWhatsApp(telefone, nome); }

  // Stub para compatibilidade
  async function loadAvaliacoes() { loadLeads(); }

  // ── IMPORTAR PLANILHA ──
  let _importData = [];
  function _normCol(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/gi,'').trim().toLowerCase();}
  function openImportarPlanilha(){if(typeof XLSX==='undefined'){showToast('Recarregue a página.','error');return;}resetImportModal();openModal('modalImportarPlanilha');}
  function resetImportModal(){_importData=[];document.getElementById('importStep1').style.display='block';document.getElementById('importStep2').style.display='none';document.getElementById('btnConfirmarImport').style.display='none';document.getElementById('importFileName').textContent='';const fi=document.getElementById('importFileInput');if(fi)fi.value='';document.getElementById('importPreviewBody').innerHTML='';}
  function handleImportDrop(e){e.preventDefault();const f=e.dataTransfer?.files?.[0];if(f)processImportFile(f);}
  function handleImportFile(input){const f=input.files?.[0];if(f)processImportFile(f);}
  function processImportFile(file){
    if(!file.name.match(/\.xlsx?$/i)){showToast('Selecione .xlsx','error');return;}
    document.getElementById('importFileName').textContent='📄 '+file.name;
    const reader=new FileReader();
    reader.onerror=()=>showToast('Erro ao ler.','error');
    reader.onload=async(evt)=>{
      try{
        const wb=XLSX.read(new Uint8Array(evt.target.result),{type:'array',cellDates:true});
        const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
        if(!aoa||aoa.length<2){showToast('Planilha vazia.','warning');return;}
        const hdrs=aoa[0].map(h=>_normCol(String(h||'')));
        const ci={
          especialista: hdrs.findIndex(h=>h.includes('especialista')),
          nome:         hdrs.findIndex(h=>h.includes('nome')),
          telefone:     hdrs.findIndex(h=>h.includes('telefone')||h.includes('celular')),
          endereco:     hdrs.findIndex(h=>h.includes('endereco')||h.includes('endereco')),
          saldo:        hdrs.findIndex(h=>h.includes('saldo')),
          parcelas:     hdrs.findIndex(h=>h==='parcelas'||(h.includes('parcela')&&!h.includes('valor'))),
          proxVenc:     hdrs.findIndex(h=>h.includes('prox')&&h.includes('venc')),
          valorParcela: hdrs.findIndex(h=>h.includes('valor')&&h.includes('parcela')),
          atraso:       hdrs.findIndex(h=>h.includes('atraso')),
          situacao:     hdrs.findIndex(h=>h.includes('situac')||h.includes('situaç'))
        };
        if(ci.especialista<0)ci.especialista=0;
        if(ci.nome<0)ci.nome=1;
        if(ci.saldo<0)ci.saldo=5;
        if(ci.parcelas<0)ci.parcelas=6;
        if(ci.proxVenc<0)ci.proxVenc=7;
        if(ci.valorParcela<0)ci.valorParcela=8;
        if(ci.atraso<0)ci.atraso=9;
        const g=(row,key)=>{const v=row[ci[key]];return v===undefined?null:v;};
        const toD=(v)=>{if(!v)return null;if(v instanceof Date)return isNaN(v)?null:v.toISOString().slice(0,10);if(typeof v==='string'&&v.match(/^\d{4}-\d{2}-\d{2}/))return v.slice(0,10);if(typeof v==='string'&&v.match(/^\d{2}\/\d{2}\/\d{4}/)){const[d,m,y]=v.split('/');return y+'-'+m+'-'+d;}if(typeof v==='number'&&v>1){const d=new Date(Math.round((v-25569)*86400*1000));return isNaN(d)?null:d.toISOString().slice(0,10);}return null;};
        const toN=(v)=>{if(v==null)return 0;if(typeof v==='number')return Math.round(v*100)/100;return parseFloat(String(v).replace(/[^\d.,]/g,'').replace(',','.'))||0;};
        const toDias=(v)=>{const m=String(v||'0').match(/(\d+)/);return m?parseInt(m[1]):0;};
        _importData=aoa.slice(1).filter(row=>{const n=String(g(row,'nome')||'').trim();return n&&n.toLowerCase()!=='total geral'&&n!=='';}).map(row=>{const ar=g(row,'atraso');const esp=String(g(row,'especialista')||'-').trim();return{especialista:esp||'-',nome:String(g(row,'nome')||'').trim(),telefone:String(g(row,'telefone')||'').trim(),endereco:String(g(row,'endereco')||'').trim(),saldo:toN(g(row,'saldo')),parcelas:String(g(row,'parcelas')||'').trim(),proxVenc:toD(g(row,'proxVenc')),valorParcela:String(g(row,'valorParcela')||'').trim(),atraso:String(ar||'').trim(),diasAtraso:toDias(ar)};});
        if(_importData.length===0){showToast('Nenhum dado válido.','warning');return;}
        await buildImportPreview();
      }catch(err){console.error('[Importar]',err);showToast('Erro: '+err.message,'error');}
    };
    reader.readAsArrayBuffer(file);
  }
  async function buildImportPreview(){
    const{data:clientes}=await sb.from('clientes').select('id,nome').eq('empresa_id',EMPRESA_ID);
    const cm={};(clientes||[]).forEach(c=>{if(c.nome)cm[_normCol(c.nome)]=c;});
    const tbody=document.getElementById('importPreviewBody');tbody.innerHTML='';
    let found=0,notFound=0;
    _importData.forEach(row=>{
      const match=cm[_normCol(row.nome)];row._clienteId=match?.id||null;
      if(match)found++;else notFound++;
      const proxFmt=row.proxVenc?(()=>{try{return new Date(row.proxVenc+'T12:00:00').toLocaleDateString('pt-BR');}catch{return row.proxVenc;}})():'-';
      const saldoFmt=row.saldo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const diasBadge=row.diasAtraso>=90?'<span style="background:#fff0f2;color:#c0001a;padding:2px 8px;border-radius:100px;font-weight:700;font-size:11px;">'+row.diasAtraso+'d ⚠️</span>':row.diasAtraso>=30?'<span style="background:#fff9e6;color:#8a5c00;padding:2px 8px;border-radius:100px;font-weight:700;font-size:11px;">'+row.diasAtraso+'d</span>':'<span style="background:#f0f2f8;color:#4a5568;padding:2px 8px;border-radius:100px;font-weight:700;font-size:11px;">'+row.diasAtraso+'d</span>';
      const st=match?'<span style="background:var(--success-bg);color:var(--success-text);padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;">✓ Vinculado</span>':'<span style="background:var(--warning-bg);color:var(--warning-text);padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;">⚡ Novo</span>';
      const tr=document.createElement('tr');tr.style.cssText='background:'+(match?'var(--success-bg)':'var(--warning-bg)')+';border-bottom:1px solid var(--border-light);';
      tr.innerHTML='<td style="padding:9px 12px;font-weight:600;font-size:12px;color:var(--primary);">'+row.especialista+'</td><td style="padding:9px 12px;font-weight:600;">'+row.nome+'</td><td style="padding:9px 12px;">'+row.parcelas+'</td><td style="padding:9px 12px;">'+proxFmt+'</td><td style="padding:9px 12px;text-align:right;font-weight:700;">'+saldoFmt+'</td><td style="padding:9px 12px;text-align:center;">'+diasBadge+'</td><td style="padding:9px 12px;text-align:center;">'+st+'</td>';
      tbody.appendChild(tr);
    });
    document.getElementById('importPreviewTitle').textContent=_importData.length+' cliente(s) na planilha';
    document.getElementById('importMatchInfo').textContent=found+' vinculado(s) · '+notFound+' novo(s)';
    document.getElementById('importStep1').style.display='none';document.getElementById('importStep2').style.display='block';document.getElementById('btnConfirmarImport').style.display='flex';
  }
  async function confirmarImportacao(){
    const btn=document.getElementById('btnConfirmarImport');btn.textContent='Importando...';btn.disabled=true;
    let ok=0,fail=0;
    const hoje=new Date().toISOString().slice(0,10);
    function parseParcelas(str){const m=String(str||'').match(/(\d+)\s*de\s*(\d+)/i);return m?{atual:parseInt(m[1]),total:parseInt(m[2])}:{atual:1,total:1};}
    function parseValor(str){if(!str)return 0;if(typeof str==='number')return Math.round(str*100)/100;return parseFloat(String(str).replace(/[^\d.,]/g,'').replace(',','.'))||0;}
    function addMonths(ds,n){const d=new Date(ds+'T12:00:00');d.setMonth(d.getMonth()+n);return d.toISOString().slice(0,10);}
    for(const row of _importData){
      try{
        let clienteId=row._clienteId;
        if(!clienteId){
          // Criar novo cliente com todos os dados disponíveis
          const obj={empresa_id:EMPRESA_ID,nome:row.nome,status:'inadimplente'};
          if(row.telefone&&row.telefone!=='null'&&row.telefone!=='')obj.celular=row.telefone;
          if(row.endereco&&row.endereco!=='null'&&row.endereco!=='')obj.endereco=row.endereco;
          const{data:c1,error:e1}=await sb.from('clientes').insert(obj).select('id').single();
          if(e1){
            // fallback mínimo
            const{data:c2,error:e2}=await sb.from('clientes').insert({empresa_id:EMPRESA_ID,nome:row.nome,status:'inadimplente'}).select('id').single();
            if(e2)throw new Error('Cliente: '+e2.message);
            clienteId=c2.id;
          } else clienteId=c1.id;
        }
        const parc=parseParcelas(row.parcelas);
        const vlrParc=parseValor(row.valorParcela)||Math.round(row.saldo/Math.max(parc.total-parc.atual+1,1)*100)/100;
        const proxVenc=row.proxVenc||hoje;
        const obsTexto='[IMPORTADO] Especialista: '+row.especialista;
        let operacaoId=null;
        const{data:opEx}=await sb.from('operacoes').select('id').eq('empresa_id',EMPRESA_ID).eq('cliente_id',clienteId).ilike('observacoes','%[IMPORTADO]%').limit(1);
        if(opEx&&opEx.length>0){
          operacaoId=opEx[0].id;
          // Atualizar observacoes com especialista actualizado e saldo
          await sb.from('operacoes').update({observacoes:obsTexto,valor_aprovado:row.saldo,num_parcelas:parc.total,valor_parcela:vlrParc}).eq('id',operacaoId).eq('empresa_id',EMPRESA_ID);
          await sb.from('parcelas').delete().eq('operacao_id',operacaoId).eq('empresa_id',EMPRESA_ID);
          await sb.from('inadimplencia').delete().eq('operacao_id',operacaoId).eq('empresa_id',EMPRESA_ID);
        }else{
          const numContrato='IMP-'+row.especialista.replace(/[^A-Z0-9]/gi,'').slice(0,4).toUpperCase()+'-'+Date.now().toString().slice(-6);
          const{data:novaOp,error:eOp}=await sb.from('operacoes').insert({empresa_id:EMPRESA_ID,cliente_id:clienteId,numero_contrato:numContrato,valor_aprovado:row.saldo,num_parcelas:parc.total,valor_parcela:vlrParc,taxa_multa:2,taxa_mora_dia:0.0333,status:'inadimplente',observacoes:obsTexto}).select('id').single();
          if(eOp)throw new Error('Operação: '+eOp.message);
          operacaoId=novaOp.id;
        }
        const parcs=[];
        for(let i=parc.atual;i<=parc.total;i++){const meses=i-parc.atual;const dv=meses===0?proxVenc:addMonths(proxVenc,meses);parcs.push({empresa_id:EMPRESA_ID,operacao_id:operacaoId,numero_parcela:i,valor_total:vlrParc,valor_principal:vlrParc,valor_juros:0,data_vencimento:dv,status:dv<hoje?'atrasada':'pendente'});}
        const{data:parcsIns,error:eParcelas}=await sb.from('parcelas').insert(parcs).select('id,numero_parcela,data_vencimento,status');
        if(eParcelas)throw new Error('Parcelas: '+eParcelas.message);
        // Usar diasAtraso da planilha para a parcela actual (mais preciso), calcular para as restantes
        for(const pa of(parcsIns||[]).filter(p=>p.status==='atrasada')){
          const diasCalc=Math.max(0,Math.floor((new Date(hoje)-new Date(pa.data_vencimento+'T12:00:00'))/86400000));
          // Se for a parcela "atual" da planilha (numero_parcela===parc.atual), usar dias da planilha
          const dias=pa.numero_parcela===parc.atual?Math.max(row.diasAtraso,diasCalc):diasCalc;
          const multa=vlrParc*0.02;const mora=vlrParc*0.000333*dias;const total=vlrParc+multa+mora;
          const inadBase={empresa_id:EMPRESA_ID,cliente_id:clienteId,operacao_id:operacaoId,parcela_id:pa.id,dias_atraso:dias,valor_devido:vlrParc,valor_multa:Math.round(multa*100)/100,valor_mora:Math.round(mora*100)/100,valor_total_devido:Math.round(total*100)/100,status:'pendente'};
          // Sempre tentar salvar com especialista; se falhar (coluna não existe), salva sem
          const{error:eI}=await sb.from('inadimplencia').insert({...inadBase,especialista:row.especialista});
          if(eI)await sb.from('inadimplencia').insert(inadBase);
        }
        await sb.from('historico_cobrancas').insert({empresa_id:EMPRESA_ID,cliente_id:clienteId,data_registro:hoje,tipo:'Importação Planilha',mensagem:'📥 Esp: '+row.especialista+' | Parc: '+row.parcelas+' | Venc: '+(row.proxVenc||'-')+' | Vlr: '+(row.valorParcela||'-')+' | Atraso: '+(row.atraso||'-')+' | '+parcs.length+' parcela(s)'});
        ok++;
      }catch(e){console.error('[Importar] '+row.nome+':',e.message);fail++;}
    }
    btn.textContent='Confirmar Importação';btn.disabled=false;
    closeModal('modalImportarPlanilha');
    if(ok>0)showToast('✅ '+ok+' cliente(s) importado(s)!','success');
    if(fail>0)showToast('⚠️ '+fail+' erro(s) — F12.','warning');
    await loadInadimplencia();
  }

  // ── BACKUP ──
  async function baixarBackupClientes(){
    const btn=document.getElementById('btnBaixarBackup');
    if(btn){btn.textContent='Gerando...';btn.disabled=true;}
    try{
      const[rCli,rAval,rOp,rParc,rInad,rHist]=await Promise.all([sb.from('clientes').select('*').eq('empresa_id',EMPRESA_ID),sb.from('avalistas').select('*').eq('empresa_id',EMPRESA_ID),sb.from('operacoes').select('*').eq('empresa_id',EMPRESA_ID),sb.from('parcelas').select('*').eq('empresa_id',EMPRESA_ID),sb.from('inadimplencia').select('*').eq('empresa_id',EMPRESA_ID),sb.from('historico_cobrancas').select('*').eq('empresa_id',EMPRESA_ID)]);
      const backup={empresa_id:EMPRESA_ID,empresa_nome:sessionStorage.getItem('microcred_empresa')||'',data_backup:new Date().toISOString(),totais:{clientes:rCli.data?.length||0,operacoes:rOp.data?.length||0,parcelas:rParc.data?.length||0,inadimplencia:rInad.data?.length||0},dados:{clientes:rCli.data||[],avalistas:rAval.data||[],operacoes:rOp.data||[],parcelas:rParc.data||[],inadimplencia:rInad.data||[],historico_cobrancas:rHist.data||[]}};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
      const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'backup_microcred_'+new Date().toISOString().slice(0,10)+'.json'});
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      showToast('✅ Backup gerado: '+backup.totais.clientes+' clientes.','success');
    }catch(e){showToast('Erro: '+e.message,'error');}
    finally{if(btn){btn.innerHTML='<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Baixar Backup Completo (.json)';btn.disabled=false;}}
  }

  // ── EXCLUIR TODOS OS DADOS ──
  async function confirmarExcluirTodosClientes(){
    if(!confirm('⚠️ Isso vai excluir TODOS os dados. NÃO pode ser desfeito. OK para continuar.'))return;
    if(!confirm('Tem a certeza absoluta?'))return;
    const btn=document.getElementById('btnExcluirTodosClientes');
    if(btn){btn.textContent='Excluindo...';btn.disabled=true;}
    const tabelas=['inadimplencia','historico_cobrancas','parcelas','renovacoes','operacoes','avaliacao_financeira','fluxo_caixa','micro_negocios','avalistas','clientes','tarefas','avaliacoes'];
    let erros=0;
    for(const t of tabelas){const{error}=await sb.from(t).delete().eq('empresa_id',EMPRESA_ID);if(error){console.warn('Erro em '+t+':',error.message);erros++;}}
    if(erros===0)showToast('✅ Todos os dados excluídos.','success');else showToast('⚠️ Concluído com '+erros+' erro(s).','warning');
    navigate('dashboard');
    if(btn){btn.innerHTML='<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Excluir Todos os Dados';btn.disabled=false;}
  }

  // ── VERIFICAR DUPLICADO ──
  let _dupTimer=null,_dupClienteId=null;
  async function verificarDuplicadoCliente(){
    const editId=document.getElementById('clienteId').value;
    if(editId)return;
    clearTimeout(_dupTimer);
    _dupTimer=setTimeout(async()=>{
      const nome=document.getElementById('cNome').value.trim();
      const cpfRaw=document.getElementById('cCpf').value.trim();
      const alerta=document.getElementById('alertaDuplicado');
      if(nome.length<3&&cpfRaw.replace(/\D/g,'').length<11){if(alerta)alerta.style.display='none';return;}
      let q=sb.from('clientes').select('id,nome,cpf,celular').eq('empresa_id',EMPRESA_ID);
      if(nome.length>=3&&cpfRaw.replace(/\D/g,'').length===11)q=q.or('nome.ilike.%'+nome+'%,cpf.eq.'+cpfRaw);
      else if(cpfRaw.replace(/\D/g,'').length===11)q=q.eq('cpf',cpfRaw);
      else q=q.ilike('nome','%'+nome+'%');
      const{data}=await q.limit(1);
      if(data&&data.length>0){_dupClienteId=data[0].id;if(alerta){alerta.style.display='block';alerta.innerHTML='⚠️ Já cadastrado: <strong>'+data[0].nome+'</strong> | CPF: '+(data[0].cpf||'—')+'<br><span style="text-decoration:underline;font-size:11px;cursor:pointer;" onclick="abrirClienteExistente()">Clique para abrir o cadastro existente</span>';}}
      else{_dupClienteId=null;if(alerta)alerta.style.display='none';}
    },600);
  }
  function abrirClienteExistente(){if(!_dupClienteId)return;closeModal('modalCliente');editRegistro('c:'+_dupClienteId);}



  // =============================================
  // WHATSAPP — MODAL FORMATADO
  // =============================================

  let _waClienteAtual = { nome: '', telefone: '' };

  function openWhatsApp(telefone, nome) {
    _waClienteAtual = { nome, telefone };
    document.getElementById('waClienteNome').textContent = nome;
    document.getElementById('waTelefone').value = telefone;
    document.getElementById('waMensagem').value = '';
    document.getElementById('waPreview').textContent = '';
    document.getElementById('waCharCount').textContent = '0 caracteres';
    openModal('modalWhatsApp');
  }

  function aplicarModelo(tipo) {
    const nome = _waClienteAtual.nome.split(' ')[0];
    const modelos = {
      saudacao:    `Olá ${nome}! 😊

Tudo bem? Sou da equipe MicroCred e estou entrando em contato para verificar se há algo em que possamos te ajudar.

Fique à vontade para nos chamar quando precisar! 🙏`,
      cobranca:    `Olá ${nome}! 👋

Identificamos uma pendência no seu contrato conosco. Gostaríamos de conversar para encontrar a melhor solução.

Podemos falar agora? ⏰`,
      vencimento:  `Olá ${nome}! 📅

Passamos para lembrá-lo(a) que sua parcela está se aproximando do vencimento.

Qualquer dúvida sobre formas de pagamento, pode nos chamar aqui. 😊`,
      confirmacao: `Olá ${nome}! ✅

Confirmamos o recebimento do seu pagamento. Obrigado pela pontualidade! 🙏

Estamos sempre à disposição.`,
      acordo:      `Olá ${nome}! 🤝

Gostaríamos de conversar sobre a possibilidade de um acordo para regularizar sua situação.

Estamos abertos para encontrar a melhor opção para você. Pode nos chamar!`,
    };
    document.getElementById('waMensagem').value = modelos[tipo] || '';
    atualizarPreviewWA();
  }

  function atualizarPreviewWA() {
    const msg = document.getElementById('waMensagem').value;
    document.getElementById('waPreview').textContent = msg;
    document.getElementById('waCharCount').textContent = msg.length + ' caracteres';
  }

  function enviarWhatsAppCliente() {
    const msg = document.getElementById('waMensagem').value.trim();
    let tel = document.getElementById('waTelefone').value.replace(/\D/g, '');
    if (!msg) return showToast('Digite uma mensagem antes de enviar.', 'warning');
    if (!tel) return showToast('Número de telefone inválido.', 'error');
    if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
    window.open('https://api.whatsapp.com/send?phone=' + tel + '&text=' + encodeURIComponent(msg), '_blank');
    closeModal('modalWhatsApp');
  }

  // Atualizar preview em tempo real
  document.addEventListener('DOMContentLoaded', () => {
    const waMsg = document.getElementById('waMensagem');
    if (waMsg) waMsg.addEventListener('input', atualizarPreviewWA);
  });

  // =============================================
  // TEMA LIGHT / DARK
  // =============================================
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const sun  = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if (!sun || !moon) return;
    if (theme === 'dark') {
      sun.style.display  = 'block';
      moon.style.display = 'none';
    } else {
      sun.style.display  = 'none';
      moon.style.display = 'block';
    }
  }

  // Aplica tema salvo ao carregar
  (function() {
    const saved = localStorage.getItem('app_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  })();

  // Ao iniciar o app, carregar badge de tarefas
  const _origInitApp = typeof initApp !== 'undefined' ? null : null;

  // =============================================
  // Inicializa o Software
  initApp();
