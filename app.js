// Valor inicial local; las sesiones disponibles se leen desde Firebase.
  const DEFAULT_SESSION = "GRUP1-XTCD-TGN";

    // Variables d'estat global
    let savedSession = localStorage.getItem("microbitada_current_session");
    if (!savedSession || savedSession === "AULA-1") {
      savedSession = DEFAULT_SESSION;
      localStorage.setItem("microbitada_current_session", savedSession);
    }
    let currentSession = savedSession;
    let currentView = "mod"; // 'mod', 'attendee', 'admin'
    let selectedLevel = 0;
    let myStudentId = localStorage.getItem("microbit_student_id") || null;
    let isAdminUnlocked = sessionStorage.getItem("microbit_admin_auth") === "true";
    let activeModeratorUnsubscribe = null;
    let activeStudentUnsubscribe = null;
    let cachedAdminData = {};
    let adminSearchQuery = "";
    let adminLevelFilter = "all";

    // Sessions conegudes i conjunt per al desplegable
    const knownSessions = new Set();
    if (currentSession) knownSessions.add(currentSession);

    // Contrasenya de seguretat
    const ADMIN_PASSWORD = "GTRoboticaBP2026";

    let isAppInitialized = false;

    // Inicialització quan Firebase estigui a punt
    window.addEventListener('firebase-ready', () => {
      if (!isAppInitialized) {
        isAppInitialized = true;
        initApp();
      }
    });

    // Fallback d'inicialització si l'esdeveniment ja s'ha disparat
    window.addEventListener('DOMContentLoaded', () => {
      const checkFirebase = setInterval(() => {
        if (window.db && window.fs) {
          clearInterval(checkFirebase);
          if (!isAppInitialized) {
            isAppInitialized = true;
            initApp();
          }
        }
      }, 80);
    });

    async function initApp() {
      // Llegir paràmetres de la URL
      const urlParams = new URLSearchParams(window.location.search);
      
      if (urlParams.has('session')) {
        const requestedSession = urlParams.get('session').toUpperCase().trim();
        currentSession = requestedSession === 'AULA-1' ? DEFAULT_SESSION : requestedSession;
        localStorage.setItem("microbitada_current_session", currentSession);
        knownSessions.add(currentSession);
      }

      const mode = urlParams.get('mode');
      const pageView = document.body.dataset.view || 'mod';
      if (mode === 'attendee' || mode === 'student') {
        currentView = 'attendee';
      } else if (mode === 'admin') {
        currentView = 'admin';
      } else {
        currentView = pageView;
      }

      if (currentView === 'admin' && !isAdminUnlocked) {
        const loginUrl = new URL('index.html', window.location.href);
        loginUrl.searchParams.set('session', currentSession);
        loginUrl.searchParams.set('mode', 'mod');
        loginUrl.searchParams.set('adminLogin', '1');
        window.location.replace(loginUrl.href);
        return;
      }

      loadAllFirebaseSessions();

      updateHeaderSessionDisplay();
      updateNavigationState();
      renderCurrentView();
      if (urlParams.get('adminLogin') === '1') {
        const loginUrl = new URL(window.location.href);
        loginUrl.searchParams.delete('adminLogin');
        window.history.replaceState({}, '', loginUrl);
        openAdminLoginModal();
      }
    }

    async function loadAllFirebaseSessions() {
      if (currentSession) knownSessions.add(currentSession);

      try {
        const snap = await window.fs.getDocs(window.fs.collection(window.db, "sessions"));
        snap.forEach(docSnap => {
          if (docSnap.id) knownSessions.add(docSnap.id);
        });
      } catch (e) {
        console.warn("Sessions collection query:", e);
      }

      try {
        const studentsSnap = await window.fs.getDocs(window.fs.collectionGroup(window.db, "students"));
        studentsSnap.forEach(stDoc => {
          const sId = stDoc.ref.parent && stDoc.ref.parent.parent ? stDoc.ref.parent.parent.id : null;
          if (sId) knownSessions.add(sId);
        });
      } catch (e) {
        console.warn("CollectionGroup students query:", e);
      }

      updateSessionDropdownOptions();
    }

    function updateSessionDropdownOptions() {
      const select = document.getElementById('session-select-dropdown');
      if (!select) return;

      const sortedSessions = Array.from(knownSessions).sort();
      
      select.innerHTML = `
        ${sortedSessions.map(s => `
          <option value="${escapeHtml(s)}" ${s === currentSession ? 'selected' : ''}>
            ${escapeHtml(s)}
          </option>
        `).join('')}
        <option value="__NEW__" style="color:var(--accent-blue);">+ Crear una nova sessió...</option>
      `;
      select.value = currentSession;
    }

    function handleSessionDropdownChange(val) {
      if (val === '__NEW__') {
        const select = document.getElementById('session-select-dropdown');
        if (select) select.value = currentSession;
        openSessionModal();
        return;
      }
      switchActiveSession(val);
    }

    function updateHeaderSessionDisplay() {
      const el = document.getElementById('header-session-name');
      if (el) el.innerText = currentSession;
      const adminSessionEl = document.getElementById('admin-current-session');
      if (adminSessionEl) adminSessionEl.innerText = currentSession;
    }

    function updateNavigationState() {
      document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
      const activeTabId = currentView === 'attendee' ? 'tab-attendee' : currentView === 'admin' ? 'tab-admin' : 'tab-mod';
      document.getElementById(activeTabId)?.classList.add('active');
    }

    // Canvi de sessió activa (des del desplegable sota el QR, capçalera o modal)
    function switchActiveSession(newSession) {
      if (!newSession) return;
      currentSession = newSession.toUpperCase().trim();
      knownSessions.add(currentSession);
      localStorage.setItem("microbitada_current_session", currentSession);
      updateHeaderSessionDisplay();

      // Assegurar a Firestore
      ensureSessionDocument(currentSession);

      // Actualitzar paràmetre URL sense recarregar la pàgina
      const url = new URL(window.location);
      url.searchParams.set('session', currentSession);
      url.searchParams.set('mode', currentView);
      window.history.replaceState({}, '', url);

      showToast(`Sessió canviada a ${currentSession}`, "info");

      // Tornar a renderitzar per connectar el listener i actualitzar el QR
      renderCurrentView();
    }

    // --- GESTIÓ DE VISTES I NAVEGACIÓ ---
    function switchView(viewName) {
      if (viewName === 'admin' && !isAdminUnlocked) {
        openAdminLoginModal();
        return;
      }

      const viewPages = { mod: 'index.html', attendee: 'participant.html', admin: 'admin.html' };
      const targetPage = viewPages[viewName];
      if (!targetPage) return;

      const url = new URL(targetPage, window.location.href);
      url.searchParams.set('session', currentSession);
      url.searchParams.set('mode', viewName);
      if (url.pathname !== window.location.pathname) {
        window.location.assign(url.href);
        return;
      }

      currentView = viewName;
      updateNavigationState();
      window.history.replaceState({}, '', url);

      renderCurrentView();
    }

    function renderCurrentView() {
      // Netejar listeners anteriors de la sessió prèvia
      if (activeModeratorUnsubscribe) {
        activeModeratorUnsubscribe();
        activeModeratorUnsubscribe = null;
      }
      if (activeStudentUnsubscribe) {
        activeStudentUnsubscribe();
        activeStudentUnsubscribe = null;
      }

      if (currentView === 'mod') {
        renderModeratorView();
      } else if (currentView === 'attendee') {
        renderStudentView();
      } else if (currentView === 'admin') {
        renderAdminView();
      }
    }

    // --- VISTA DEL MODERADOR (PROJECCIÓ / TAULELL) ---
    function renderModeratorView() {
      const app = document.getElementById('app');
      
      // Assegurar existència de la sessió a Firestore
      ensureSessionDocument(currentSession);

      app.innerHTML = `
        <div class="dashboard">
          <!-- Panell QR -->
          <div class="qr-card">
            <h3><i class="fa-solid fa-qrcode" style="color:var(--accent-green);"></i> Accés de participants</h3>
            <p>Escaneja amb el mòbil per triar el teu nivell d'experiència</p>
            
            <div class="qr-box" id="qrcode"></div>
            
            <!-- Desplegable amb totes les sessions obertes a Firebase -->
            <div class="qr-session-dropdown-box">
              <label for="session-select-dropdown" class="switcher-label">
                <i class="fa-solid fa-layer-group" style="color:var(--accent-green);"></i> Sessió activa:
              </label>
              <div class="select-wrapper">
                <select id="session-select-dropdown" class="session-dropdown" onchange="handleSessionDropdownChange(this.value)">
                  <!-- Es carrega dinàmicament amb totes les sessions de Firebase -->
                </select>
              </div>
            </div>

            <div class="qr-actions">
              <button class="btn-secondary" onclick="openSessionModal()">
                <i class="fa-solid fa-plus"></i> Crear una nova sessió
              </button>
              <button class="btn-secondary" onclick="copyStudentLink()">
                <i class="fa-regular fa-copy"></i> Copiar l'enllaç
              </button>
              <button class="btn-secondary" onclick="openStudentTab()">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Obrir en una pestanya nova
              </button>
            </div>
          </div>

          <!-- Controls i llistat d'equips -->
          <div class="controls-panel">
            <div class="stats-bar">
              <div class="stat-card">
                <div class="stat-label">Total d'inscrits</div>
                <div class="stat-value" id="count-total">0</div>
              </div>
              <div class="stat-card stat-l1">
                <div class="stat-label">N1 novell</div>
                <div class="stat-value" id="count-l1">0</div>
              </div>
              <div class="stat-card stat-l2">
                <div class="stat-label">N2 bàsic</div>
                <div class="stat-value" id="count-l2">0</div>
              </div>
              <div class="stat-card stat-l3">
                <div class="stat-label">N3 intermedi</div>
                <div class="stat-value" id="count-l3">0</div>
              </div>
              <div class="stat-card stat-l4">
                <div class="stat-label">N4 avançat</div>
                <div class="stat-value" id="count-l4">0</div>
              </div>
            </div>

            <!-- Botons d'acció -->
            <div class="moderator-actions-bar">
              <div class="input-group">
                <label for="numGroups"><i class="fa-solid fa-users-line"></i> Nre. d'equips:</label>
                <input type="number" id="numGroups" class="input-number" value="4" min="2" max="25">
              </div>

              <button class="btn-main" onclick="generateHeterogeneousGroups()">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Generar equips heterogenis
              </button>

              <button class="btn-warning" onclick="resetGroupsOnly()" title="Reinicia l'assignació d'equips sense esborrar els alumnes">
                <i class="fa-solid fa-rotate-left"></i> Desfer equips
              </button>

              <button class="btn-danger" onclick="confirmResetCurrentSession()" title="Esborra tots els participants d'aquesta sessió">
                <i class="fa-regular fa-trash-can"></i> Buidar sessió
              </button>
            </div>

            <!-- Contenidor dinàmic d'equips -->
            <div id="groups-container" class="groups-grid">
              <p style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding: 30px;">
                Carregant participants en temps real...
              </p>
            </div>

            <!-- Llista de participants en espera si encara no s'han agrupat -->
            <div id="waiting-room-container" style="display:none; margin-top:15px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px;">
              <h4 style="font-size:0.9rem; color:var(--text-muted); margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-user-clock" style="color:var(--accent-blue);"></i> Participants pendents d'assignar grup:
              </h4>
              <div id="waiting-students-tags" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            </div>
          </div>
        </div>
      `;

      // Generar codi QR per a participants
      const studentUrl = getStudentDirectUrl();
      const qrTarget = document.getElementById("qrcode");
      if (qrTarget) {
        qrTarget.innerHTML = '';
        new QRCode(qrTarget, {
          text: studentUrl,
          width: 170,
          height: 170,
          colorDark: "#080c14",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }

      // Actualitzar desplegable de sessions
      updateSessionDropdownOptions();
      loadAllFirebaseSessions();

      // Escoltar en temps real la col·lecció de la sessió actual
      const colRef = window.fs.collection(window.db, "sessions", currentSession, "students");
      activeModeratorUnsubscribe = window.fs.onSnapshot(colRef, (snapshot) => {
        const students = [];
        snapshot.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        updateModeratorDashboard(students);
      }, (err) => {
        console.error("Error en escoltar estudiants:", err);
        showToast("Error de connexió en temps real amb Firebase", "error");
      });
    }

    function getStudentDirectUrl() {
      const participantUrl = new URL('participant.html', window.location.href);
      participantUrl.searchParams.set('session', currentSession);
      participantUrl.searchParams.set('mode', 'attendee');
      return participantUrl.href;
    }

    function copyStudentLink() {
      const url = getStudentDirectUrl();
      navigator.clipboard.writeText(url).then(() => {
        showToast("Enllaç copiat al porta-retalls!", "success");
      }).catch(() => {
        prompt("Copia l'enllaç manualment:", url);
      });
    }

    function openStudentTab() {
      window.open(getStudentDirectUrl(), '_blank');
    }

    function updateModeratorDashboard(students) {
      // Comptadors
      const totalEl = document.getElementById('count-total');
      const l1El = document.getElementById('count-l1');
      const l2El = document.getElementById('count-l2');
      const l3El = document.getElementById('count-l3');
      const l4El = document.getElementById('count-l4');

      if (!totalEl) return;

      totalEl.innerText = students.length;
      l1El.innerText = students.filter(s => s.level === 1).length;
      l2El.innerText = students.filter(s => s.level === 2).length;
      l3El.innerText = students.filter(s => s.level === 3).length;
      l4El.innerText = students.filter(s => s.level === 4).length;

      // Agrupació d'estudiants
      const groupsMap = {};
      const unassigned = [];

      students.forEach(s => {
        if (s.group) {
          if (!groupsMap[s.group]) groupsMap[s.group] = [];
          groupsMap[s.group].push(s);
        } else {
          unassigned.push(s);
        }
      });

      const container = document.getElementById('groups-container');
      const waitingContainer = document.getElementById('waiting-room-container');
      const waitingTags = document.getElementById('waiting-students-tags');

      // Gestió d'alumnes pendents
      if (unassigned.length > 0) {
        waitingContainer.style.display = 'block';
        waitingTags.innerHTML = unassigned.map(s => `
          <span style="background:var(--bg-dark); border:1px solid var(--border-color); padding:4px 10px; border-radius:15px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
            <span>${escapeHtml(s.name)}</span>
            <span class="badge badge-${s.level}">N${s.level}</span>
          </span>
        `).join('');
      } else {
        waitingContainer.style.display = 'none';
      }

      // Si no hi ha equips creats encara
      if (Object.keys(groupsMap).length === 0) {
        if (students.length === 0) {
          container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding: 45px 20px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
              <i class="fa-solid fa-users-viewfinder fa-3x" style="color:var(--text-dim); margin-bottom:12px;"></i>
              <h4 style="color:var(--text-main); margin-bottom:6px;">Esperant participants a ${escapeHtml(currentSession)}</h4>
              <p style="font-size:0.9rem;">Escanegeu el codi QR amb els dispositius mòbils per començar a registrar-vos.</p>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding: 40px 20px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <i class="fa-solid fa-circle-check fa-2x" style="color:var(--accent-green); margin-bottom:10px;"></i>
              <h4 style="color:var(--text-main); margin-bottom:6px;">Hi ha ${students.length} participants registrats a ${escapeHtml(currentSession)}</h4>
              <p style="font-size:0.9rem; margin-bottom:15px;">Feu clic a <strong>"Generar equips heterogenis"</strong> per crear la distribució equilibrada.</p>
            </div>
          `;
        }
        return;
      }

      // Renderitzar targetes dels equips
      container.innerHTML = '';
      const sortedGroupIds = Object.keys(groupsMap).map(Number).sort((a, b) => a - b);

      sortedGroupIds.forEach(gId => {
        const members = groupsMap[gId];
        const hasL4 = members.some(m => m.level === 4);

        const card = document.createElement('div');
        card.className = `group-card ${hasL4 ? 'has-advanced' : ''}`;
        card.innerHTML = `
          <div class="group-header">
            <span class="group-title">Equip ${gId}</span>
            <div style="display:flex; align-items:center; gap:6px;">
              ${hasL4 ? '<i class="fa-solid fa-star" style="color:var(--accent-orange);" title="Compta amb membre d\'avançat"></i>' : ''}
              <span style="font-size:0.8rem; background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:10px; color:var(--text-muted);">${members.length} membres</span>
            </div>
          </div>
          <ul class="member-list">
            ${members.map(m => `
              <li class="member-item">
                <span style="font-weight:500;">${escapeHtml(m.name)}</span>
                <span class="badge badge-${m.level}">N${m.level}</span>
              </li>
            `).join('')}
          </ul>
        `;
        container.appendChild(card);
      });
    }

    // --- ALGORISME D'AGRUPACIÓ HETEROGÈNIA ---
    async function generateHeterogeneousGroups() {
      const numGroupsInput = document.getElementById('numGroups');
      const numGroups = parseInt(numGroupsInput.value) || 4;

      if (numGroups < 2) {
        showToast("El nombre mínim d'equips és 2", "error");
        return;
      }

      try {
        const colRef = window.fs.collection(window.db, "sessions", currentSession, "students");
        const snapshot = await window.fs.getDocs(colRef);

        let students = [];
        snapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));

        if (students.length === 0) {
          showToast(`No hi ha participants registrats a la sessió ${currentSession}`, "error");
          return;
        }

        if (numGroups > students.length) {
          showToast(`No pots crear ${numGroups} equips amb només ${students.length} participants`, "error");
          return;
        }

        // Distribució heterogènia equilibrada (Snake Distribution per nivell)
        const l4 = students.filter(s => s.level === 4);
        const l3 = students.filter(s => s.level === 3);
        const l2 = students.filter(s => s.level === 2);
        const l1 = students.filter(s => s.level === 1);

        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

        // Agrupem començant pels més avançats
        const ordered = [
          ...shuffle(l4),
          ...shuffle(l3),
          ...shuffle(l2),
          ...shuffle(l1)
        ];

        const groups = Array.from({ length: numGroups }, () => []);

        // Distribució seqüencial simple
        ordered.forEach((student, index) => {
          groups[index % numGroups].push(student);
        });

        // Actualitzar a Firebase
        for (let g = 0; g < groups.length; g++) {
          const groupNumber = g + 1;
          for (let student of groups[g]) {
            await window.fs.updateDoc(window.fs.doc(window.db, "sessions", currentSession, "students", student.id), {
              group: groupNumber
            });
          }
        }

        showToast(`S'han generat ${numGroups} equips heterogenis a ${currentSession}!`, "success");
      } catch (err) {
        console.error("Error en generar equips:", err);
        showToast("Error en generar els equips: " + err.message, "error");
      }
    }

    async function resetGroupsOnly() {
      if (!confirm("Vols desfer els equips assignats i deixar tots els alumnes com a pendents?")) return;

      try {
        const colRef = window.fs.collection(window.db, "sessions", currentSession, "students");
        const snapshot = await window.fs.getDocs(colRef);

        for (const docSnap of snapshot.docs) {
          await window.fs.updateDoc(docSnap.ref, { group: null });
        }

        showToast("S'ha reiniciat l'assignació d'equips", "info");
      } catch (err) {
        showToast("Error en desfer equips: " + err.message, "error");
      }
    }

    async function confirmResetCurrentSession() {
      if (!confirm(`Segur que vols esborrar tots els participants de la sessió ${currentSession}? Aquesta acció no es pot desfer.`)) {
        return;
      }

      try {
        const colRef = window.fs.collection(window.db, "sessions", currentSession, "students");
        const snapshot = await window.fs.getDocs(colRef);

        for (const docSnap of snapshot.docs) {
          await window.fs.deleteDoc(docSnap.ref);
        }

        showToast(`S'ha buidat la sessió ${currentSession}`, "success");
      } catch (err) {
        showToast("Error en buidar la sessió: " + err.message, "error");
      }
    }

    // --- VISTA DEL PARTICIPANT (MÒBIL / REGISTRE) ---
    function renderStudentView() {
      const app = document.getElementById('app');

      // Si ja s'ha registrat amb anterioritat en aquest dispositiu
      if (myStudentId) {
        const docRef = window.fs.doc(window.db, "sessions", currentSession, "students", myStudentId);
        
        activeStudentUnsubscribe = window.fs.onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.group) {
              app.innerHTML = `
                <div class="student-view-container">
                  <div class="assigned-view">
                    <div style="font-size:2.4rem; color:var(--accent-green); margin-bottom:10px;">
                      <i class="fa-solid fa-trophy"></i>
                    </div>
                    <h2 style="font-size:1.6rem; font-weight:700;">Hola, ${escapeHtml(data.name)}!</h2>
                    <p style="color:var(--text-muted); margin-top:8px;">Has estat assignat/da al grup:</p>
                    
                    <div class="group-badge-large">Equip ${data.group}</div>
                    
                    <p style="font-size:1.05rem; margin-top:10px; color:var(--accent-blue);">
                      <i class="fa-solid fa-users"></i> Troba els teus companys i comença la micro:bitada!
                    </p>

                    <div style="margin-top:25px; padding-top:15px; border-top:1px solid var(--border-color);">
                      <button class="btn-secondary" style="margin:0 auto;" onclick="reRegisterStudent()">
                        <i class="fa-solid fa-arrow-rotate-left"></i> Modificar registre o sortir
                      </button>
                    </div>
                  </div>
                </div>
              `;
            } else {
              app.innerHTML = `
                <div class="student-view-container">
                  <div class="assigned-view">
                    <div style="font-size:2.2rem; color:var(--accent-blue); margin-bottom:12px;">
                      <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <h2 style="font-size:1.5rem;">Hola, ${escapeHtml(data.name)}!</h2>
                    <p style="margin-top: 10px; color: var(--accent-green); font-weight:600;">S'han rebut les teves dades correctament.</p>
                    <p style="margin-top: 12px; color: var(--text-muted); font-size:0.95rem;">Esperant que el docent generi els equips heterogenis...</p>
                    
                    <div style="margin: 25px 0;">
                      <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--accent-green);"></i>
                    </div>

                    <div style="padding-top:15px; border-top:1px solid var(--border-color);">
                      <button class="btn-secondary" style="margin:0 auto;" onclick="reRegisterStudent()">
                        <i class="fa-solid fa-pen"></i> Canviar nom o nivell
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }
          } else {
            // El document ha estat esborrat pel moderador
            localStorage.removeItem("microbit_student_id");
            myStudentId = null;
            renderStudentView();
          }
        }, (err) => {
          console.error("Error en escoltar estat alumne:", err);
        });
        return;
      }

      // Formulari de registre de nou participant
      app.innerHTML = `
        <div class="student-view-container">
          <div style="background:var(--bg-surface); padding:26px; border-radius:var(--radius-lg); border:1px solid var(--border-color); box-shadow:var(--shadow-subtle);">
            <div style="text-align:center; margin-bottom:22px;">
              <span class="badge" style="background:rgba(0, 230, 118, 0.15); color:var(--accent-green); margin-bottom:8px; border:1px solid rgba(0, 230, 118, 0.3);">
                Sessió: ${currentSession}
              </span>
              <h2 style="font-size:1.45rem; font-family:'Orbitron', sans-serif;"><i class="fa-solid fa-user-plus"></i> Registre de participant</h2>
              <p style="font-size:0.88rem; color:var(--text-muted); margin-top:4px;">Inscriu-te a la micro:bitada per rebre el teu equip</p>
            </div>
            
            <div class="form-group">
              <label for="studentName"><i class="fa-regular fa-user"></i> El teu nom i cognom:</label>
              <input type="text" id="studentName" placeholder="Ex: Maria Puig" autocomplete="name" required>
            </div>

            <div class="form-group">
              <label><i class="fa-solid fa-chart-simple"></i> Nivell d'experiència en micro:bit:</label>
              <div class="level-options">
                <button type="button" class="level-btn" onclick="selectLevel(1, this)">
                  <div class="level-info">
                    <span class="level-title">1. Novell</span>
                    <span class="level-desc">Mai he fet servir una placa micro:bit</span>
                  </div>
                  <span class="badge badge-1">Nivell 1</span>
                </button>

                <button type="button" class="level-btn" onclick="selectLevel(2, this)">
                  <div class="level-info">
                    <span class="level-title">2. Bàsic</span>
                    <span class="level-desc">Conec MakeCode i la programació per blocs</span>
                  </div>
                  <span class="badge badge-2">Nivell 2</span>
                </button>

                <button type="button" class="level-btn" onclick="selectLevel(3, this)">
                  <div class="level-info">
                    <span class="level-title">3. Intermedi</span>
                    <span class="level-desc">He creat programes senzills i sé carregar-los</span>
                  </div>
                  <span class="badge badge-3">Nivell 3</span>
                </button>

                <button type="button" class="level-btn" onclick="selectLevel(4, this)">
                  <div class="level-info">
                    <span class="level-title">4. Avançat</span>
                    <span class="level-desc">Domino sensors, ràdio, variables i lògica</span>
                  </div>
                  <span class="badge badge-4">Nivell 4</span>
                </button>
              </div>
            </div>

            <button class="btn-main" style="width:100%; padding:14px; font-size:1.05rem;" onclick="registerStudent()">
              <i class="fa-solid fa-paper-plane"></i> Enviar i unir-me
            </button>
          </div>
        </div>
      `;
    }

    function selectLevel(lvl, btn) {
      selectedLevel = lvl;
      document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }

    async function registerStudent() {
      const nameInput = document.getElementById('studentName');
      const name = nameInput.value.trim();

      if (!name) {
        showToast("Si us plau, escriu el teu nom i cognom", "error");
        nameInput.focus();
        return;
      }
      if (selectedLevel === 0) {
        showToast("Si us plau, selecciona el teu nivell d'experiència", "error");
        return;
      }

      const newStudentId = "std_" + Math.random().toString(36).substring(2, 11);

      try {
        // Assegurar sessió doc
        await ensureSessionDocument(currentSession);

        // Guardar alumne
        await window.fs.setDoc(window.fs.doc(window.db, "sessions", currentSession, "students", newStudentId), {
          name: name,
          level: selectedLevel,
          group: null,
          timestamp: Date.now()
        });

        localStorage.setItem("microbit_student_id", newStudentId);
        myStudentId = newStudentId;
        renderStudentView();
        showToast("T'has inscrit correctament a la micro:bitada!", "success");
      } catch (err) {
        console.error("Error en registrar:", err);
        showToast("Error en desar el registre: " + err.message, "error");
      }
    }

    function reRegisterStudent() {
      if (confirm("Vols cancel·lar aquest registre i inscriure't de nou?")) {
        localStorage.removeItem("microbit_student_id");
        myStudentId = null;
        selectedLevel = 0;
        renderStudentView();
      }
    }

    // --- ESPAI D'ADMINISTRACIÓ (GESTOR DE BASE DE DADES FIREBASE) ---
    async function renderAdminView() {
      const app = document.getElementById('app');

      app.innerHTML = `
        <div class="admin-panel">
          <!-- Barra superior d'administració -->
          <div class="admin-header-bar">
            <div class="admin-title-area">
              <div class="brand-icon-box" style="border-color:var(--accent-purple); color:var(--accent-purple); background:rgba(129, 140, 248, 0.15);">
                <i class="fa-solid fa-server"></i>
              </div>
              <div>
                <h2>Gestor de base de dades Firebase</h2>
                <div style="font-size:0.84rem; color:var(--text-muted); margin-top:2px;">
                  Projecte: <code style="color:var(--accent-blue);">dinamica-escape-room-microbit</code>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <button class="btn-secondary" onclick="loadAndRenderAdminData()">
                <i class="fa-solid fa-rotate"></i> Refrescar dades
              </button>
              <button class="btn-secondary" onclick="logoutAdmin()">
                <i class="fa-solid fa-lock"></i> Tancar sessió
              </button>
            </div>
          </div>

          <!-- Llistat de sessions a Firebase -->
          <div class="sessions-shelf">
            <div class="shelf-title">
              <span><i class="fa-solid fa-folder-tree"></i> Sessions trobades a Firebase:</span>
              <button class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="openSessionModal()">
                <i class="fa-solid fa-plus"></i> Nova sessió
              </button>
            </div>
            
            <div class="sessions-grid" id="admin-sessions-grid">
              <p style="color:var(--text-muted); padding:10px;">Carregant sessions...</p>
            </div>
          </div>

          <!-- Taula de participants de la sessió seleccionada -->
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
              <div>
                <h3 style="font-size:1.15rem; font-family:'Orbitron', sans-serif;">
                  Dades de la sessió: <span id="admin-current-session" style="color:var(--accent-green);">${escapeHtml(currentSession)}</span>
                </h3>
                <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;" id="admin-session-summary">
                  Calculant resum...
                </p>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn-secondary" onclick="exportSessionToCSV()">
                  <i class="fa-solid fa-file-csv" style="color:var(--accent-green);"></i> Exportar a CSV
                </button>
                <button class="btn-warning" onclick="resetGroupsOnly()">
                  <i class="fa-solid fa-rotate-left"></i> Desfer equips
                </button>
                <button class="btn-danger" onclick="deleteCurrentSessionFromAdmin()">
                  <i class="fa-solid fa-trash-can"></i> Eliminar sessió
                </button>
              </div>
            </div>

            <!-- Filtres i cerca -->
            <div class="filter-bar">
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <input type="text" class="search-input" id="admin-search-input" placeholder="Cercar participant..." oninput="handleAdminSearch(this.value)">
                
                <div style="display:flex; gap:6px;">
                  <button class="btn-secondary filter-tag active" data-lvl="all" onclick="filterAdminByLevel('all', this)">Tots</button>
                  <button class="btn-secondary filter-tag" data-lvl="1" onclick="filterAdminByLevel('1', this)">N1</button>
                  <button class="btn-secondary filter-tag" data-lvl="2" onclick="filterAdminByLevel('2', this)">N2</button>
                  <button class="btn-secondary filter-tag" data-lvl="3" onclick="filterAdminByLevel('3', this)">N3</button>
                  <button class="btn-secondary filter-tag" data-lvl="4" onclick="filterAdminByLevel('4', this)">N4</button>
                </div>
              </div>
            </div>

            <!-- Taula d'alumnes -->
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Nivell</th>
                    <th>Equip</th>
                    <th>Data de registre</th>
                    <th style="text-align:right;">Accions</th>
                  </tr>
                </thead>
                <tbody id="admin-students-tbody">
                  <tr>
                    <td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
                      Carregant dades dels participants...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      await loadAndRenderAdminData();
    }

    async function loadAndRenderAdminData() {
      try {
        const sessionsMap = {}; // sessionId -> { students: [] }

        // 1. Llegir col·lecció 'sessions' per si hi ha documents de sessió
        try {
          const sessionsSnap = await window.fs.getDocs(window.fs.collection(window.db, "sessions"));
          sessionsSnap.forEach(sDoc => {
            sessionsMap[sDoc.id] = { id: sDoc.id, students: [] };
          });
        } catch (e) {
          console.warn("Sessions collection query:", e);
        }

        // 2. Llegir tots els estudiants mitjançant collectionGroup
        try {
          const allStudentsSnap = await window.fs.getDocs(window.fs.collectionGroup(window.db, "students"));
          allStudentsSnap.forEach(stDoc => {
            const data = { id: stDoc.id, ...stDoc.data() };
            const sId = stDoc.ref.parent && stDoc.ref.parent.parent ? stDoc.ref.parent.parent.id : currentSession;
            if (!sessionsMap[sId]) {
              sessionsMap[sId] = { id: sId, students: [] };
            }
            sessionsMap[sId].students.push(data);
          });
        } catch (e) {
          console.warn("CollectionGroup students query error, utilitzant fallback directe:", e);
          // Fallback: carregar només la sessió actual si collectionGroup fallés
          if (!sessionsMap[currentSession]) {
            sessionsMap[currentSession] = { id: currentSession, students: [] };
          }
          const currSnap = await window.fs.getDocs(window.fs.collection(window.db, "sessions", currentSession, "students"));
          currSnap.forEach(stDoc => {
            sessionsMap[currentSession].students.push({ id: stDoc.id, ...stDoc.data() });
          });
        }

        cachedAdminData = sessionsMap;
        renderAdminSessionCards();
        renderAdminStudentsTable();
      } catch (err) {
        console.error("Error carregant dades d'administració:", err);
        showToast("Error carregant dades de Firebase: " + err.message, "error");
      }
    }

    function renderAdminSessionCards() {
      const container = document.getElementById('admin-sessions-grid');
      if (!container) return;

      const sessionKeys = Object.keys(cachedAdminData).sort();
      if (sessionKeys.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">No s'han trobat sessions a Firebase.</p>`;
        return;
      }

      container.innerHTML = sessionKeys.map(sId => {
        const session = cachedAdminData[sId];
        const count = session.students.length;
        const countL4 = session.students.filter(s => s.level === 4).length;
        const isActive = sId === currentSession;

        return `
          <div class="session-card ${isActive ? 'active-session' : ''}" data-session-id="${escapeHtml(sId)}" onclick="selectSessionFromAdmin(this.getAttribute('data-session-id'))">
            <div class="session-card-header">
              <span class="session-card-name">
                <i class="fa-solid ${isActive ? 'fa-folder-open' : 'fa-folder'}" style="color:${isActive ? 'var(--accent-purple)' : 'var(--text-muted)'}; margin-right:6px;"></i>
                ${escapeHtml(sId)}
              </span>
              ${isActive ? '<span class="badge" style="background:var(--accent-purple); color:white;">Activa</span>' : ''}
              <button class="action-icon-btn" type="button" title="Eliminar sessió" aria-label="Eliminar sessió ${escapeHtml(sId)}" onclick="event.stopPropagation(); deleteSessionFromAdmin(this.closest('.session-card').getAttribute('data-session-id'))">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="session-card-meta">
              <span><i class="fa-regular fa-user"></i> ${count} participants</span>
              <span><i class="fa-solid fa-star" style="color:var(--accent-orange);"></i> ${countL4} N4</span>
            </div>
          </div>
        `;
      }).join('');
    }

    function selectSessionFromAdmin(sId) {
      if (!sId) return;
      switchActiveSession(sId);
    }

    function renderAdminStudentsTable() {
      const tbody = document.getElementById('admin-students-tbody');
      const summaryEl = document.getElementById('admin-session-summary');
      if (!tbody) return;

      const currentData = cachedAdminData[currentSession] || { students: [] };
      let students = currentData.students || [];

      if (summaryEl) {
        const groupsCount = new Set(students.map(s => s.group).filter(Boolean)).size;
        summaryEl.innerHTML = `Total: <strong>${students.length}</strong> participants | Equips formats: <strong>${groupsCount}</strong>`;
      }

      // Filtrar per cerca
      if (adminSearchQuery) {
        const q = adminSearchQuery.toLowerCase();
        students = students.filter(s => (s.name || '').toLowerCase().includes(q));
      }

      // Filtrar per nivell
      if (adminLevelFilter !== 'all') {
        const lvl = parseInt(adminLevelFilter);
        students = students.filter(s => s.level === lvl);
      }

      if (students.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; color:var(--text-muted); padding:35px 20px;">
              <i class="fa-regular fa-folder-open fa-2x" style="margin-bottom:8px; color:var(--text-dim);"></i>
              <div>No s'han trobat participants amb aquests criteris a ${escapeHtml(currentSession)}.</div>
            </td>
          </tr>
        `;
        return;
      }

      // Ordenar per data de registre (més recents primer)
      students.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      tbody.innerHTML = students.map(s => {
        const formattedDate = s.timestamp 
          ? new Date(s.timestamp).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
          : '—';

        const groupBadge = s.group 
          ? `<span class="badge" style="background:rgba(0, 229, 255, 0.15); color:var(--accent-blue); border:1px solid rgba(0, 229, 255, 0.3);">Equip ${s.group}</span>`
          : `<span style="color:var(--text-dim); font-size:0.85rem;">Sense assignar</span>`;

        return `
          <tr>
            <td>
              <div style="font-weight:600;">${escapeHtml(s.name || 'Sense nom')}</div>
              <div style="font-size:0.75rem; color:var(--text-dim); font-family:monospace;">${s.id}</div>
            </td>
            <td>
              <span class="badge badge-${s.level}">Nivell ${s.level}</span>
            </td>
            <td>${groupBadge}</td>
            <td style="color:var(--text-muted); font-size:0.85rem;">${formattedDate}</td>
            <td style="text-align:right;">
              <button class="action-icon-btn" title="Eliminar aquest participant" onclick="deleteSingleStudent('${s.id}')">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function handleAdminSearch(val) {
      adminSearchQuery = val.trim();
      renderAdminStudentsTable();
    }

    function filterAdminByLevel(lvl, btn) {
      adminLevelFilter = lvl;
      document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAdminStudentsTable();
    }

    async function deleteSingleStudent(studentId) {
      const currentData = cachedAdminData[currentSession] || { students: [] };
      const student = (currentData.students || []).find(s => s.id === studentId);
      const studentName = student ? (student.name || 'Participant') : studentId;

      if (!confirm(`Segur que vols eliminar a "${studentName}" de Firebase?`)) {
        return;
      }

      try {
        await window.fs.deleteDoc(window.fs.doc(window.db, "sessions", currentSession, "students", studentId));
        showToast(`Participant ${studentName} eliminat`, "success");
        await loadAndRenderAdminData();
      } catch (err) {
        showToast("Error en eliminar participant: " + err.message, "error");
      }
    }

    function deleteCurrentSessionFromAdmin() {
      deleteSessionFromAdmin(currentSession);
    }

    async function deleteSessionFromAdmin(sId) {
      if (!sId) return;
      if (!confirm(`Segur que vols eliminar completament la sessió "${sId}" i tots els seus participants de Firebase?`)) {
        return;
      }

      try {
        const studentsRef = window.fs.collection(window.db, "sessions", sId, "students");
        const sessionRef = window.fs.doc(window.db, "sessions", sId);
        const snap = await window.fs.getDocsFromServer(studentsRef);
        await Promise.all(snap.docs.map(studentDoc => window.fs.deleteDoc(studentDoc.ref)));
        await window.fs.deleteDoc(sessionRef);

        const [remainingStudents, remainingSession] = await Promise.all([
          window.fs.getDocsFromServer(studentsRef),
          window.fs.getDocFromServer(sessionRef)
        ]);
        if (!remainingStudents.empty || remainingSession.exists()) {
          throw new Error("Firebase no ha confirmat l'eliminació completa de la sessió.");
        }

        showToast(`Sessió ${sId} eliminada correctament`, "success");

        knownSessions.delete(sId);
        delete cachedAdminData[sId];
        if (sId === currentSession) {
          const nextSession = Object.keys(cachedAdminData).sort()[0] || DEFAULT_SESSION;
          currentSession = nextSession;
          localStorage.setItem("microbitada_current_session", nextSession);
          updateHeaderSessionDisplay();
          const url = new URL(window.location.href);
          url.searchParams.set('session', nextSession);
          url.searchParams.set('mode', 'admin');
          window.history.replaceState({}, '', url);
        }

        updateSessionDropdownOptions();

        await loadAndRenderAdminData();
      } catch (err) {
        showToast("Error en eliminar sessió de Firebase: " + (err.code || err.message), "error");
      }
    }

    function exportSessionToCSV() {
      const currentData = cachedAdminData[currentSession] || { students: [] };
      const students = currentData.students || [];

      if (students.length === 0) {
        showToast("No hi ha dades per exportar en aquesta sessió", "error");
        return;
      }

      const headers = ["ID", "Nom", "Nivell", "Equip", "Data de registre"];
      const rows = students.map(s => [
        s.id,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        s.level,
        s.group ? `Equip ${s.group}` : "Sense equip",
        s.timestamp ? new Date(s.timestamp).toLocaleString('ca-ES') : ""
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `microbitada_${currentSession}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Fitxer CSV descarregat correctament", "success");
    }

    // --- AUTENTICACIÓ DE L'ADMINISTRADOR ---
    function openAdminLoginModal() {
      const modal = document.getElementById('admin-login-modal');
      const input = document.getElementById('admin-pwd-input');
      const errEl = document.getElementById('admin-pwd-error');
      
      if (errEl) errEl.style.display = 'none';
      if (input) input.value = '';
      if (modal) modal.style.display = 'flex';
      setTimeout(() => input && input.focus(), 150);
    }

    function closeAdminLoginModal() {
      const modal = document.getElementById('admin-login-modal');
      if (modal) modal.style.display = 'none';
    }

    function verifyAdminPassword() {
      const input = document.getElementById('admin-pwd-input');
      const errEl = document.getElementById('admin-pwd-error');
      const pwd = input.value;

      if (pwd === ADMIN_PASSWORD) {
        isAdminUnlocked = true;
        sessionStorage.setItem("microbit_admin_auth", "true");
        closeAdminLoginModal();
        showToast("Accés concedit a l'administració", "success");
        switchView('admin');
      } else {
        if (errEl) errEl.style.display = 'block';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
      }
    }

    // Tecla Enter al camp de contrasenya
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const modal = document.getElementById('admin-login-modal');
        if (modal && modal.style.display === 'flex') {
          verifyAdminPassword();
        }
      }
    });

    function logoutAdmin() {
      isAdminUnlocked = false;
      sessionStorage.removeItem("microbit_admin_auth");
      showToast("Sessió d'administració tancada", "info");
      switchView('mod');
    }

    function togglePasswordVisibility(inputId, btn) {
      const input = document.getElementById(inputId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      }
    }

    // --- GESTIÓ DEL MODAL DE SESSIÓ ---
    function openSessionModal() {
      const modal = document.getElementById('change-session-modal');
      const input = document.getElementById('new-session-input');
      if (input) input.value = currentSession;
      if (modal) modal.style.display = 'flex';
      setTimeout(() => input && input.focus(), 100);
    }

    function closeSessionModal() {
      const modal = document.getElementById('change-session-modal');
      if (modal) modal.style.display = 'none';
    }

    async function confirmChangeSession() {
      const input = document.getElementById('new-session-input');
      const newSession = input.value.trim().toUpperCase();

      if (!newSession) {
        showToast("Escriu un nom per a la sessió", "error");
        return;
      }

      currentSession = newSession;
      knownSessions.add(currentSession);
      localStorage.setItem("microbitada_current_session", currentSession);
      updateHeaderSessionDisplay();
      closeSessionModal();

      await ensureSessionDocument(currentSession);
      showToast(`Sessió canviada a ${currentSession}`, "success");
      updateSessionDropdownOptions();

      // Actualitzar URL
      const url = new URL(window.location);
      url.searchParams.set('session', currentSession);
      window.history.replaceState({}, '', url);

      renderCurrentView();
    }

    async function ensureSessionDocument(sId) {
      try {
        await window.fs.setDoc(window.fs.doc(window.db, "sessions", sId), {
          name: sId,
          lastActive: Date.now()
        }, { merge: true });
      } catch (e) {
        console.warn("No s'ha pogut actualitzar el document arrel de sessió:", e);
      }
    }

    // --- UTILITATS ---
    function showToast(message, type = "info") {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      
      let icon = "fa-solid fa-info-circle";
      if (type === "success") icon = "fa-solid fa-circle-check";
      if (type === "error") icon = "fa-solid fa-triangle-exclamation";

      toast.innerHTML = `<i class="${icon}"></i> <span>${escapeHtml(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
