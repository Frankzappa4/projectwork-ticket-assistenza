const authForms = document.querySelectorAll(".auth-form");
const switchButtons = document.querySelectorAll("[data-switch]");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

// Riferimenti per la Gestione Utenti (Modal)
const openUserManagementBtn = document.getElementById('open-user-management');
const closeUserManagementBtn = document.getElementById('close-user-management');
const userManagementModal = document.getElementById('user-management-modal');
const userTableBody = document.getElementById('user-table-body'); // <tbody> della tabella utenti

// Riferimento al contatore degli utenti nello span del pulsante
const userCountDisplay = document.getElementById('user-count-display');

// RIFERIMENTI PER DASHBOARD UTENTE
const openProfileManagementBtn = document.getElementById('open-profile-management');
const closeProfileManagementBtn = document.getElementById('close-profile-management');
const profileManagementModal = document.getElementById('profile-management-modal');
const profileUpdateForm = document.getElementById('profile-update-form');

// Variabili per i campi del form
const profileNameInput = document.getElementById('profile-name');
const profileEmailInput = document.getElementById('profile-email');
const profilePasswordInput = document.getElementById('profile-password');

// FUNZIONE PER CARICARE I DATI DEL PROFILO UTENTE CORRENTE E POPOLARE IL MODALE
async function fetchUserProfile() {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (!userId || userRole === 'admin') {
        // Se l'ID non è presente (utente non loggato) o se siamo l'admin (che non ha questa sezione)
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/users/${userId}`);

        if (!response.ok) {
            // Se il server restituisce 404, l'utente non esiste più nel DB
            console.error(`Errore API: ${response.status} - Impossibile recuperare il profilo.`);
            throw new Error('Errore durante il recupero del profilo');
        }
        
        const user = await response.json();
        
        // Popolazione dei campi
        profileNameInput.value = user.name; 
        profileEmailInput.value = user.email || localStorage.getItem('userEmail') || '';
        // Il campo password DEVE essere sempre vuoto per non inviare l'hash
        if (profilePasswordInput) {
             profilePasswordInput.value = ''; 
        }

    } catch (error) {
        console.error("Errore nel caricamento del profilo:", error);
        // Mostra un messaggio visivo all'utente se la chiamata fallisce
         alert("Impossibile caricare i dati del profilo.");
    }
}

// CHIAMATA ALLA FUNZIONE AL CARICAMENTO DELLA DASHBOARD UTENTE
if (document.body.classList.contains('dashboard') && !document.body.classList.contains('admin')) {
    fetchUserProfile();
}

// LISTENER PER L'APERTURA E CHIUSURA DEL MODALE GESTIONE PROFILO
if (openProfileManagementBtn && profileManagementModal && closeProfileManagementBtn) {
    // Apertura del modale
    openProfileManagementBtn.addEventListener('click', () => {
        profileManagementModal.classList.add('is-active');
        // CARICA I DATI CORRENTI
        fetchUserProfile(); 
    });
    
    // Chiusura del modale (tramite pulsante X)
    closeProfileManagementBtn.addEventListener('click', () => {
        profileManagementModal.classList.remove('is-active');
    });

    // Chiusura del modale (cliccando fuori dalla finestra)
    profileManagementModal.addEventListener('click', (e) => {
        if (e.target.id === 'profile-management-modal') {
            profileManagementModal.classList.remove('is-active');
        }
    });
}

//FUNZIONE PER RECUPERARE IL CONTEGGIO UTENTI
async function fetchUserCountAndRender() {
    if (!userCountDisplay) return; // Controlla se l'elemento esiste nel DOM

    try {
        const response = await fetch('http://localhost:3000/api/users');
        const users = await response.json();
        const count = users.length; 
        
        // AGGIORNA IL TESTO DELLO SPAN CON IL NUMERO DI UTENTI
        userCountDisplay.textContent = count; 

    } catch (error) {
        console.error('Errore nel recupero del conteggio utenti:', error);
        // In caso di errore, mostra la 'N' di default
        userCountDisplay.textContent = 'N'; 
    }
}

// FUNZIONE PER ELIMINARE UN UTENTE (Chiamata da listener)
async function deleteUser(userId) {
    if (!confirm(`Sei sicuro di voler eliminare l'utente #${userId}? Verranno cancellati anche tutti i suoi ticket e le note associate.`)) {
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            alert(`Utente #${userId} eliminato con successo.`);
            // Aggiorna entrambe le liste dopo l'eliminazione
            fetchAndRenderAllUsers(); 
            fetchUserCountAndRender();
        } else {
            const data = await response.json();
            alert("Errore nell'eliminazione dell'utente: " + data.message);
        }
    } catch (error) {
        console.error('Errore di rete/server durante l\'eliminazione:', error);
        alert("Impossibile connettersi al server.");
    }
}

// FUNZIONE PER RECUPERARE E RENDERIZZARE TUTTI GLI UTENTI (nel modale)
async function fetchAndRenderAllUsers() {
    if (!userTableBody) return;

    userTableBody.innerHTML = '<tr><td colspan="5">Caricamento utenti...</td></tr>';

    try {
        const response = await fetch('http://localhost:3000/api/users');
        const users = await response.json();
        
        userTableBody.innerHTML = ''; 

        if (users.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="5">Nessun utente registrato (a parte l\'admin).</td></tr>';
            return;
        }

        users.forEach(user => {
            const date = new Date(user.created_at).toLocaleDateString('it-IT');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${date}</td>
                <td>
                    <button type="button" class="delete-user" data-user-id="${user.id}">Elimina</button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Errore nel recupero degli utenti:', error);
        userTableBody.innerHTML = '<tr><td colspan="5">Errore nel recupero degli utenti.</td></tr>';
    }
}

// FUNZIONE: AGGIORNAMENTO PROFILO
async function updateProfile(name, email, passwordToSend) {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("ID utente non trovato. Riprova ad accedere.");
        return;
    }

    const data = { name, email };
    // Utilizza passwordToSend che è già validato o è null
    if (passwordToSend) { 
        data.newPassword = passwordToSend;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            // Aggiorna il localStorage con i nuovi dati (tranne la password)
            localStorage.setItem('userName', name);
            localStorage.setItem('userEmail', email);

            // Chiudi il modale e ricarica (o mostra l'alert per il relogin)
            profileManagementModal.classList.remove('is-active');
            
            // Suggerisci il relogin se l'email è cambiata
            if (result.message.includes('email')) {
                 alert("Email aggiornata. Si prega di effettuare nuovamente l'accesso con la nuova email.");
                 window.location.href = 'index.html'; // Reindirizza al login
            }
            
        } else {
            alert("Errore: " + result.message);
        }

    } catch (error) {
        console.error('Errore di rete/server durante l\'aggiornamento:', error);
        alert("Impossibile connettersi al server per aggiornare il profilo.");
    }
}

// LISTENER PER L'INVIO DEL FORM DI AGGIORNAMENTO PROFILO
if (profileUpdateForm) {
    profileUpdateForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = profileNameInput.value.trim();
        const email = profileEmailInput.value.trim();
        const newPasswordValue = profilePasswordInput.value;
        const newPassword = newPasswordValue.trim(); 

        // Validazione: La password è stata inserita (non è vuota) MA non è valida
        if (newPasswordValue.length > 0 && newPassword.length === 0) {
            alert("La nuova password non può contenere solo spazi vuoti.");
            return; 
        }
        
        // Se la password è stata inserita, usiamo il suo valore pulito, altrimenti è null
        // Controlliamo che la lunghezza pulita sia > 0.
        const passwordToSend = newPassword.length > 0 ? newPassword : null; 

        if (name && email) {
            updateProfile(name, email, passwordToSend);
        } else {
             alert("Nome ed Email non possono essere vuoti.");
        }
    });
}

// INIZIANO I LISTENER E LA LOGICA DEI FORM / SWITCH
const showForm = (targetId) => {
    authForms.forEach((form) => {
        form.classList.toggle("is-active", form.id === targetId);
    });
};

if (authForms.length && switchButtons.length) {
    switchButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.switch;
            if (target) {
                showForm(target);
            }
        });
    });
}

// LOGICA DI REGISTRAZIONE (CHIAMA L'API)
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Raccoglie e pulisce i dati dal form
        const nameInput = registerForm.querySelector('input[type="text"]').value.trim();
        const emailInput = registerForm.querySelector('input[type="email"]').value.trim();
        const passwordInput = registerForm.querySelector('input[type="password"]').value.trim();

        // VALIDAZIONE FRONTEND
        if (nameInput.length === 0) {
            alert("Il nome è obbligatorio.");
            return; 
        }

        if (passwordInput.length === 0) {
            alert("La password è obbligatoria e deve contenere almeno 1 carattere.");
            return; 
        }
        
        // Chiamata all'API di Registrazione (backend)
        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: nameInput,
                    email: emailInput,
                    password: passwordInput
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Successo nella registrazione
                alert("Registrazione avvenuta con successo! Effettua il Login.");

                registerForm.reset();
                showForm('login-form');
            } else {
                // Errore: email già usata, o dati mancanti
                alert("Errore di registrazione: " + data.message);
            }

        } catch (error) {
            console.error('Errore di rete/server:', error);
            alert("Impossibile connettersi al server. Assicurati che il backend sia attivo sulla porta 3000.");
        }
    });
}

// LOGICA DI LOGIN (CHIAMA L'API)
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Raccoglie e pulisce i dati dal form
        const emailInput = loginForm.querySelector('input[type="email"]').value.trim();
        const passwordInput = loginForm.querySelector('input[type="password"]').value.trim();

        // VALIDAZIONE FRONTEND
        if (passwordInput.length === 0) {
            alert("La password è obbligatoria.");
            return; 
        }

        // Chiamata all'API di Login (backend)
        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailInput,
                    password: passwordInput
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // AGGIUNGIAMO IL SALVATAGGIO DELL'UTENTE
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('role', data.role);
                localStorage.setItem('userEmail', emailInput); // utile per la dashboard utente

                // Successo: naviga in base al ruolo ricevuto dal backend
                if (data.role === 'admin') {
                    window.location.href = "dashboard-admin.html";
                } else {
                    window.location.href = "dashboard-user.html";
                }


            } else {
                // Errore: Credenziali non valide
                alert("Login fallito: " + data.message);
            }

        } catch (error) {
            console.error('Errore di rete/server:', error);
            alert("Impossibile connettersi al server. Assicurati che il backend sia attivo.");
        }
    });
}

// LOGICA DEI TICKET UTENTE (VISUALIZZAZIONE e CREAZIONE)
const ticketListUl = document.querySelector(".ticket-list ul");
const ticketForm = document.getElementById("ticket-creation-form");
const userId = localStorage.getItem('userId'); // Recuperiamo l'ID utente


// NUOVA FUNZIONE: Carica e renderizza i ticket dell'utente
async function fetchAndRenderTickets(userId) {
    if (!ticketListUl) return;

    ticketListUl.innerHTML = '<li>Caricamento ticket in corso...</li>';

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${userId}`);
        const tickets = await response.json();

        if (response.ok) {
            ticketListUl.innerHTML = '';

            if (tickets.length === 0) {
                ticketListUl.innerHTML = '<li>Non hai ancora aperto alcun ticket.</li>';
                return;
            }

            tickets.forEach(ticket => {
                const li = document.createElement('li');
                const statusClass = ticket.status === 'Risolto' ? 'status-risolto' :
                    ticket.status === 'In lavorazione' ? 'status-lavorazione' : 'status-attesa';

                li.innerHTML = `
                    <strong>${ticket.title} (#${ticket.id})</strong>
                    - Stato: <span class="${statusClass}">${ticket.status}</span> 
                    - Priorità: ${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                `;
                ticketListUl.appendChild(li);
            });

        } else {
            ticketListUl.innerHTML = `<li>Errore nel caricamento: ${tickets.message}</li>`;
        }

    } catch (error) {
        console.error('Errore di rete/server:', error);
        ticketListUl.innerHTML = '<li>Impossibile connettersi al server per recuperare i ticket.</li>';
    }
}

// 1. ESECUZIONE INIZIALE: Carica i ticket se l'utente è loggato e sulla dashboard
if (userId && ticketListUl) {
    fetchAndRenderTickets(userId);
}

// 2. LOGICA DI CREAZIONE TICKET
if (ticketForm && userId) {
    ticketForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Raccoglie i dati dal form
        const title = ticketForm.querySelector('input[type="text"]').value;
        const description = ticketForm.querySelector('textarea').value;
        const priority = ticketForm.querySelector('select').value;

        // Dati da inviare all'API
        const ticketData = {
            user_id: parseInt(userId),
            title: title,
            description: description,
            priority: priority,
        };

        // Chiamata all'API di creazione ticket
        try {
            const response = await fetch('http://localhost:3000/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(ticketData),
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Ticket #${data.ticketId} creato con successo!`);
                ticketForm.reset();
                // CHIAMIAMO LA FUNZIONE PER AGGIORNARE LA LISTA SUBITO DOPO LA CREAZIONE
                fetchAndRenderTickets(userId);
            } else {
                alert("Errore durante la creazione del ticket: " + data.message);
            }

        } catch (error) {
            console.error('Errore di rete/server:', error);
            alert("Impossibile connettersi al server per inviare il ticket.");
        }
    });
}

// FUNZIONI DI GESTIONE TICKET (CRUD & NOTE)
// Funzione: Carica e renderizza TUTTI i ticket (Admin)
async function fetchAndRenderAllTickets() {
    // Eseguiamo solo se siamo sulla pagina Admin e l'elemento esiste
    if (!ticketTableBody) return;

    // Messaggio di caricamento
    ticketTableBody.innerHTML = '<tr><td colspan="6">Caricamento di tutti i ticket in corso...</td></tr>';

    try {
        // Chiamata alla nuova API per recuperare tutti i ticket
        const response = await fetch('http://localhost:3000/api/all-tickets');
        const tickets = await response.json();

        if (response.ok) {
            ticketTableBody.innerHTML = ''; // Pulizia

            if (tickets.length === 0) {
                ticketTableBody.innerHTML = '<tr><td colspan="6">Nessun ticket presente nel sistema.</td></tr>';
                return;
            }

            // Popoliamo la tabella con i dati
            tickets.forEach(ticket => {
                const tr = document.createElement('tr');

                // Creiamo il menu a tendina per lo stato, pre-selezionando lo stato attuale
                const statusSelect = `
                    <select data-ticket-id="${ticket.id}">
                        <option value="In attesa" ${ticket.status === 'In attesa' ? 'selected' : ''}>In attesa</option>
                        <option value="In lavorazione" ${ticket.status === 'In lavorazione' ? 'selected' : ''}>In lavorazione</option>
                        <option value="Risolto" ${ticket.status === 'Risolto' ? 'selected' : ''}>Risolto</option>
                    </select>
                `;

                tr.innerHTML = `
                    <td>
                        <input type="checkbox" class="select-ticket-checkbox" data-ticket-id="${ticket.id}" />
                    </td>
                    <td>#${ticket.id}</td>
                    <td>${ticket.user_name} (${ticket.user_email})</td>
                    <td>${ticket.title}</td>
                    <td>${statusSelect}</td>
                    <td>${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}</td>
                    <td>
                        <button type="button" class="delete-ticket" data-ticket-id="${ticket.id}">Elimina</button>
                    </td>
                `;
                ticketTableBody.appendChild(tr);
            });

        } else {
            ticketTableBody.innerHTML = `<tr><td colspan="6">Errore nel caricamento: ${tickets.message}</td></tr>`;
        }

    } catch (error) {
        console.error('Errore di rete/server:', error);
        ticketTableBody.innerHTML = '<tr><td colspan="6">Impossibile connettersi al server per recuperare i ticket.</td></tr>';
    }
}

// FUNZIONE PER GESTIRE IL CAMBIO DI STATO
async function updateTicketStatus(ticketId, newStatus) {
    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
        });

        if (response.ok) {
            console.log(`Stato del Ticket #${ticketId} aggiornato a: ${newStatus}`);
            alert(`Stato del Ticket #${ticketId} aggiornato con successo a: ${newStatus}!`);
        } else {
            const data = await response.json();
            alert(`Errore nell'aggiornamento dello stato del ticket #${ticketId}: ${data.message}`);
        }
    } catch (error) {
        console.error('Errore di rete/server durante l\'aggiornamento:', error);
        alert("Impossibile connettersi al server per aggiornare lo stato.");
    }
}

// FUNZIONE PER ELIMINARE UN TICKET
async function deleteTicket(ticketId) {
    if (!confirm(`Sei sicuro di voler eliminare il ticket #${ticketId}? L'azione è irreversibile e cancellerà anche tutte le note associate.`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            alert(`Ticket #${ticketId} eliminato con successo.`);

            // 1. RICARICA LA LISTA DEI TICKET (per rimuovere la riga eliminata)
            fetchAndRenderAllTickets(); // Ricarica la lista principale
            fetchAndRenderHistory();

            // 2. AZIONI AGGIUNTIVE PER L'ADMIN DASHBOARD
            // Pulisce l'input nascosto del ticket corrente
            const currentTicketIdInput = document.getElementById('current-ticket-id');
            if (currentTicketIdInput && currentTicketIdInput.value === ticketId) {
                currentTicketIdInput.value = '';
            }

            // Pulisce il container delle note
            const notesListContainer = document.getElementById('notes-list');
            if (notesListContainer) {
                notesListContainer.innerHTML = '';
            }

            // l'input nascosto deve essere pulito
            document.getElementById('current-ticket-id').value = '';

        } else {
            const data = await response.json();
            alert("Errore durante l'eliminazione del ticket: " + data.message);
        }

    } catch (error) {
        console.error('Errore di rete/server durante l\'eliminazione:', error);
        alert("Impossibile connettersi al server per eliminare il ticket.");
    }
}

// FUNZIONE per recuperare e visualizzare lo storico dei ticket
async function fetchAndRenderHistory() {
    const historyList = document.getElementById('deleted-tickets-list');
    if (!historyList) return;

    try {
        const response = await fetch('http://localhost:3000/api/history/deleted-tickets');
        const historyData = await response.json();

        if (response.ok) {
            let html = '';
            if (historyData.length === 0) {
                html = '<p>Nessun ticket eliminato recentemente.</p>';
            } else {
                historyData.forEach(item => {
                    // Formattazione della data
                    const deletedTime = new Date(item.deleted_at).toLocaleString('it-IT', { 
                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
                    });
                    
                    // Tronca la descrizione
                    const shortDescription = item.description.length > 80 
                        ? item.description.substring(0, 80) + '...'
                        : item.description;

                    html += `
                        <div class="deleted-ticket-item">
                            <p><strong>Ticket #${item.original_id}</strong> (Utente: ${item.original_user_name})</p>
                            <p class="history-title">${item.title}</p>
                            <p class="history-desc">${shortDescription}</p>
                            <span class="history-meta">Eliminato il ${deletedTime}</span>
                        </div>
                        <hr>
                    `;
                });
            }
            historyList.innerHTML = html;
        } else {
            historyList.innerHTML = `<p class="error">Errore nel caricamento: ${historyData.message}</p>`;
        }
    } catch (error) {
        console.error('Errore nel recupero storico:', error);
        historyList.innerHTML = '<p class="error">Impossibile connettersi al server.</p>';
    }
}

// FUNZIONE PER CARICARE E RENDERIZZARE LE NOTE INTERNE
async function fetchAndRenderNotes(ticketId) {
    const notesListContainer = document.getElementById('notes-list');
    notesListContainer.innerHTML = 'Caricamento note...';

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}/notes`);

        if (response.ok) {
            const notes = await response.json();

            if (notes.length === 0) {
                notesListContainer.innerHTML = '<p class="note-empty">Nessuna nota interna per questo ticket.</p>';
                return;
            }

            // HTML per le note con classi specifiche
            let notesHtml = notes.map(note => {
                const date = new Date(note.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="note-item">
                        <p class="note-content">${note.content}</p>
                        <small class="note-meta">Da: ${note.admin_name} il ${date}</small>
                    </div>
                `;
            }).join('');

            notesListContainer.innerHTML = notesHtml;

        } 
        else {
            notesListContainer.innerHTML = `<p class="note-error">Errore nel caricamento delle note.</p>`;
        }
    } 
    catch (error) {
        console.error('Errore durante il recupero delle note:', error);
        notesListContainer.innerHTML = '<p class="note-error">Errore di connessione al server per le note.</p>';
    }
}

// FUNZIONE PER AGGIUNGERE UNA NOTA INTERNA
async function addInternalNote(ticketId, content) {
    // Recupera l'ID dell'admin loggato
    const adminId = localStorage.getItem('userId');

    if (!ticketId || !content || !adminId) {
        alert("Errore: ID Ticket, contenuto o ID Admin mancante.");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_id: parseInt(ticketId),
                // USIAMO 'user_id' COME CHIAVE NEL JSON CHE INVIA AL BACKEND.
                // IL BACKEND (server.js) SA CHE DEVE MAPPARE QUESTO SU 'admin_id'.
                user_id: parseInt(adminId),
                content: content
            }),
        });

        if (response.ok) {
            alert("Nota interna aggiunta con successo!");
            document.querySelector('#add-note-form textarea').value = ''; // Pulisce la textarea
            fetchAndRenderNotes(ticketId);
        } else {
            const data = await response.json();
            alert("Errore nell'aggiunta della nota: " + data.message);
        }

    } catch (error) {
        console.error('Errore di rete/server durante l\'aggiunta della nota:', error);
        alert("Impossibile connettersi al server per aggiungere la nota.");
    }
}

// FUNZIONE PER GESTIRE L'APERTURA E CHIUSURA DEL MODALE
if (openUserManagementBtn && userManagementModal && closeUserManagementBtn) {
    // Apertura del modale
    openUserManagementBtn.addEventListener('click', () => {
        userManagementModal.classList.add('is-active');
        // Carica i dati non appena il modale viene aperto
        fetchAndRenderAllUsers(); 
        fetchUserCountAndRender();
    });

    // Chiusura del modale (tramite pulsante X)
    closeUserManagementBtn.addEventListener('click', () => {
        userManagementModal.classList.remove('is-active');
    });

    // Chiusura del modale (cliccando fuori dalla finestra)
    userManagementModal.addEventListener('click', (e) => {
        if (e.target.id === 'user-management-modal') {
            userManagementModal.classList.remove('is-active');
        }
    });
}



// VARIABILI GLOBALI E ESECUZIONE INIZIALE ADMIN
// LOGICA DEI TICKET ADMIN (VISUALIZZAZIONE DI TUTTI I TICKET)

// Selezioniamo il corpo della tabella e recuperiamo il ruolo dell'utente loggato
const ticketTableBody = document.querySelector(".ticket-table tbody");
const userRole = localStorage.getItem('role');
// NOTE
const addNoteForm = document.getElementById('add-note-form');
const currentTicketIdInput = document.getElementById('current-ticket-id');

// LOGICA PER GESTIRE IL COLLAPSE DEI WIDGET)
const collapseButtons = document.querySelectorAll('.collapse-btn');

if (collapseButtons.length > 0) {
    collapseButtons.forEach(button => {
        button.addEventListener('click', () => {
            // L'articolo (card) è il genitore del pulsante che vogliamo collassare/espandere
            const parentCard = button.closest('.card');
            
            // Toggle della classe 'is-collapsed' sul contenitore principale
            parentCard.classList.toggle('is-collapsed');

            // Aggiorna l'icona da '+' a '−' (o 'X' a seconda del CSS)
            const iconSpan = button.querySelector('.collapse-icon');
            if (parentCard.classList.contains('is-collapsed')) {
                iconSpan.textContent = '+';
            } else {
                iconSpan.textContent = '−';
            }
        });
    });
}

// ESECUZIONE INIZIALE PER ADMIN DASHBOARD: Lancia la funzione se l'utente è un admin
if (userRole === 'admin' && ticketTableBody) {
    fetchAndRenderAllTickets();
    // CARICA IL CONTEGGIO UTENTI ALL'AVVIO
    fetchUserCountAndRender(); 
    // storico ticket
    fetchAndRenderHistory();
}

// LISTENER E GESTIONE NOTE INTERNE (ADMIN DASHBOARD)
// LISTENER PER L'INVIO DELLE NOTE INTERNE
if (addNoteForm) {
    addNoteForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const content = addNoteForm.querySelector('textarea').value;
        const ticketId = currentTicketIdInput.value;

        if (ticketId) {
            addInternalNote(ticketId, content);
        } else {
            alert("Seleziona prima un ticket dalla lista per aggiungere una nota.");
        }
    });
}

// LISTENER UNIFICATO PER LA TABELLA ADMIN
// (Event Delegation)
if (ticketTableBody) {

    // GESTIONE CAMBIO STATO
    ticketTableBody.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT' && e.target.dataset.ticketId) {
            const ticketId = e.target.dataset.ticketId;
            const newStatus = e.target.value;
            updateTicketStatus(ticketId, newStatus);
        }
    });

    // GESTIONE CLICK (Elimina e Selezione Checkbox)
    ticketTableBody.addEventListener('click', (e) => {

        // 1. Logica per ELIMINAZIONE
        if (e.target.classList.contains('delete-ticket') && e.target.dataset.ticketId) {
            const ticketId = e.target.dataset.ticketId;
            deleteTicket(ticketId);
            return; // Esci per non interferire con la selezione
        }

        // 2. Logica per SELEZIONE CHECKBOX
        if (e.target.classList.contains('select-ticket-checkbox') && e.target.dataset.ticketId) {
            const selectedId = e.target.dataset.ticketId;

            // Deseleziona tutti gli altri checkbox per permettere solo una selezione alla volta
            document.querySelectorAll('.select-ticket-checkbox').forEach(cb => {
                if (cb !== e.target) {
                    cb.checked = false;
                    cb.closest('tr').classList.remove('is-active');
                }
            });

            // Imposta l'ID per le Note e attiva/disattiva la riga
            if (e.target.checked) {
                currentTicketIdInput.value = selectedId;
                e.target.closest('tr').classList.add('is-active');

                //CARICA LE NOTE DEL TICKET SELEZIONATO
                fetchAndRenderNotes(selectedId);

            } else {
                currentTicketIdInput.value = ''; // Rimuove l'ID se deselezionato
                e.target.closest('tr').classList.remove('is-active');
                // Pulisce la lista quando si deseleziona
                document.getElementById('notes-list').innerHTML = '';
            }
        }
    });

}


// LISTENER PER L'ELIMINAZIONE DEGLI UTENTI (nel Modale)
if (userTableBody) {
    userTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-user') && e.target.dataset.userId) {
            const userId = e.target.dataset.userId;
            deleteUser(userId);
        }
    });
}