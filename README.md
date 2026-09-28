# Generador de grups micro:bitada

Aplicació web en temps real connectada a **Firebase Firestore** per organitzar i dinamitzar jornades tecnològiques de la **micro:bitada** (tallers, escape rooms educatius i reptes cooperatius de robòtica i programació amb BBC micro:bit).

Permet que l'alumnat s'inscrigui des del seu telèfon mòbil o tauleta indicant el seu nivell d'experiència i genera automàticament equips equilibrats i heterogenis per afavorir l'aprenentatge entre iguals (*peer learning*).

---

## 🎯 Per què equips heterogenis?

En activitats tecnològiques com la micro:bitada, si els grups es fan a l'atzar pur o per afinitat, sovint queden equips descompensats (equips formats només per experts o equips formats només per alumnes novells que poden quedar bloquejats).

Aquesta eina utilitza un **algorisme de repartiment serpentina (*snake distribution*) amb barreja aleatòria per nivell**:
1. Agrupa i barreja primer l'alumnat de **Nivell 4 (Avançat)** i els reparteix equitativament entre tots els equips.
2. Continua amb el **Nivell 3 (Intermedi)**, **Nivell 2 (Bàsic)** i **Nivell 1 (Novell)** en ordre invers a cada tongada.
3. El resultat és que **tots els equips compten amb un nivell global similar**, amb referents capaços de guiar el grup i companys amb diferents habilitats per col·laborar.

---

## 👩‍🏫 Guia d'ús per al docent pas a pas

### 1. Preparar la projecció a l'aula
1. Obre l'enllaç de l'aplicació en un navegador a l'ordinador connectat al projector o pantalla gran:
   👉 **[https://antonnin.github.io/heterogeneous-group-dynamic/](https://antonnin.github.io/heterogeneous-group-dynamic/)**
2. Per defecte, l'aplicació s'obre a la pestanya **Taulell del moderador**.
3. L'aplicació compta amb dues sessions preconfigurades per a treballar en paral·lel:
   - **`GRUP1-XTCD-TGN`** (Grup 1)
   - **`GRUP2-XTCD-TGN`** (Grup 2)
4. Sota el codi QR veuràs els botons per seleccionar fàcilment **`GRUP 1`** o **`GRUP 2`**. Fes clic al grup que vulguis projectar.

---

### 2. Registre dels participants
1. Demana als alumnes que **escanegin el codi QR** que es projecta a la pantalla amb la càmera del seu telèfon mòbil o tauleta.
   *(Si algun dispositiu no pot llegir el QR, fes clic al botó **Copiar l'enllaç** i comparteix-lo pel xat de classe, Google Classroom o Teams).*
2. Cada participant introduirà el seu **nom i cognom** i triarà el seu nivell d'experiència real amb micro:bit:
   - **Nivell 1 (Novell)**: Mai ha fet servir una placa micro:bit.
   - **Nivell 2 (Bàsic)**: Coneix l'entorn MakeCode i la programació visual per blocs.
   - **Nivell 3 (Intermedi)**: Ha creat programes senzills i sap carregar el codi a la placa.
   - **Nivell 4 (Avançat)**: Domina sensors, comunicació per ràdio, variables i lògica.
3. Quan l'alumne prem **"Enviar i unir-me"**, el seu mòbil mostrarà una pantalla d'espera amb el missatge *"S'han rebut les teves dades correctament. Esperant que el docent generi els equips heterogenis..."*.
4. A la pantalla del docent, els comptadors d'inscrits s'actualitzaran **en temps real**.

---

### 3. Generar els equips heterogenis
1. Un cop s'hagi inscrit tot l'alumnat, introdueix el **nombre d'equips** que vols crear al camp corresponent (per exemple: `4`, `5` o `6` equips).
2. Fes clic al botó verd **"Generar equips heterogenis"**.
3. A la pantalla gran apareixeran les targetes de cada equip amb els seus integrants i els distintius de nivell (els equips amb integrants de nivell avançat mostren una estrella daurada ⭐).
4. **Màgia en temps real:** En el mateix instant, els mòbils de tots els alumnes s'actualitzaran sols, mostrant-los el número d'equip assignat (*"Equip 1"*, *"Equip 2"*, etc.) i el missatge per trobar els seus companys i començar la micro:bitada!

---

### 4. Gestió simultània de dos grups (Sessions en paral·lel)
Si estàs coordinant dues aules o dos grups simultanis:
- Pots commutar entre **`GRUP1-XTCD-TGN`** i **`GRUP2-XTCD-TGN`** fent clic als botons ràpids situats sota el codi QR.
- El codi QR s'adaptarà immediatament a la sessió seleccionada.
- Totes les dades i llistes d'inscrits són **completament independents** a Firebase; el que passi al Grup 1 no afecta al Grup 2.

---

### 5. Espai d'administració (Gestió de la base de dades)
A la barra de navegació superior trobaràs la pestanya **"Espai administració"**:
1. Fes-hi clic i introdueix la contrasenya d'accés per al docent:
   🔑 **Contrasenya:** `GTRoboticaBP2026`
2. Un cop a dins, trobaràs el **Gestor de base de dades Firebase**, on podràs:
   - **Visualitzar tots els participants:** Taula interactiva amb nom, ID únic de Firebase, nivell i equip assignat.
   - **Cercar i filtrar:** Cercador per text i filtres ràpids per nivell (N1 a N4).
   - **Exportar a CSV:** Descarregar un fitxer de full de càlcul compatible amb Excel o Google Sheets amb tot el llistat d'assistents i equips.
   - **Eliminar participants individuals:** Fent clic a la icona de la paperera 🗑️ d'un alumne concret si s'ha equivocat de nom.
   - **Desfer equips:** Permet cancel·lar l'assignació d'equips i deixar tots els alumnes com a pendents si vols canviar el nombre d'equips sense que hagin de tornar a registrar-se.
   - **Buidar o eliminar la sessió:** Elimina les dades de la sessió un cop finalitzada la jornada per deixar la plataforma neta per al proper taller.

---

## 🛠️ Tecnologies utilitzades

- **Frontend:** HTML5 semàntic, Vanilla CSS modern (disseny *cyber-dark*, *glassmorphism* i disseny adaptatiu mòbil/projector) i JavaScript modular.
- **Backend i temps real:** Firebase Firestore (modular SDK v10.8.0) amb sincronització de dades en viu mitjançant *snapshots*.
- **Llibreries:** QRCode.js per a la generació dinàmica de codis QR i FontAwesome 6 per a la iconografia.
- **Desplegament:** GitHub Pages allotjat a la branca `main`.
