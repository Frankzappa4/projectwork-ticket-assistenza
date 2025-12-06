const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config(); //Variabili d'ambiente
const app = express();
const PORT = 3000;
const saltRounds = 10; 

// Middleware: Permette al server di interpretare JSON nelle richieste
app.use(express.json());
app.use(cors());
app.use(express.static('.'))

// Configurazione della connessione al Database MySQL
const dbConfig = {
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE, 
};

let connection;

// Funzione per creare le tabelle
async function createTables() {
    // Definizione delle query SQL per creare le tabelle users, tickets e notes
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100),
            role ENUM('user', 'admin') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createTicketsTable = `
        CREATE TABLE IF NOT EXISTS tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            priority ENUM('bassa', 'media', 'alta') DEFAULT 'bassa',
            status ENUM('In attesa', 'In lavorazione', 'Risolto') DEFAULT 'In attesa',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE 
        );
    `;

    const createNotesTable = `
        CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT,
            admin_id INT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
        );
    `;

    const createDeletedTicketsTable = `
        CREATE TABLE IF NOT EXISTS deleted_tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            original_id INT,
            original_user_id INT,
            original_user_name VARCHAR(100),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            priority ENUM('bassa', 'media', 'alta'),
            status ENUM('in_attesa', 'in_lavorazione', 'risolto'),
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

// ESECUZIONE delle query
    try {
        await connection.query(createUsersTable);
        await connection.query(createTicketsTable);
        await connection.query(createNotesTable);
        await connection.query(createDeletedTicketsTable);
        console.log('Tabelle create o già esistenti.');
        
        await seedAdminUser(); 
        
    } catch (error) {
        console.error('Errore durante la creazione delle tabelle:', error);
    }
}

// Funzione per creare un utente admin iniziale
async function seedAdminUser() {
    const adminEmail = process.env.ADMIN_DEFAULT_EMAIL;
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD; 
    
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (rows.length === 0) {
        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
        
        const insertQuery = `
            INSERT INTO users (email, password_hash, name, role)
            VALUES (?, ?, ?, ?)
        `;
        await connection.query(insertQuery, [adminEmail, hashedPassword, 'System Admin', 'admin']);
        console.log(`Utente admin di default creato: ${adminEmail} / ${adminPassword}`);
    } else {
        console.log('Utente admin di default già esistente.');
    }
}

// Funzione di inizializzazione
async function initializeDatabase() {
    try {
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
        });

        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await tempConnection.end();

        connection = await mysql.createConnection(dbConfig);
        console.log('Connessione a MySQL stabilita con successo.');

        await createTables(); 
        
    } catch (error) {
        console.error('Errore durante la connessione o l\'inizializzazione del database:', error);
        process.exit(1);
    }
}

// ROUTE: REGISTRAZIONE UTENTE (/api/register)
app.post('/api/register', async (req, res) => {
    // Estrae i dati inviati dal frontend
    const { name, email, password } = req.body;

    // Pulisce gli input da spazi bianchi iniziali/finali per i controlli e l'inserimento
    const trimmedName = name ? name.trim() : '';
    const trimmedPassword = password ? password.trim() : '';
    const trimmedEmail = email ? email.trim() : '';
    
    // Controllo di base per la presenza di tutti i campi obbligatori
    if (!trimmedEmail || !trimmedPassword || !trimmedName) {
        return res.status(400).json({ message: 'Nome, email e password sono campi obbligatori.' });
    }

    // VALIDAZIONE: Nome (minimo 1 carattere non spazio)
    if (trimmedName.length === 0) {
        return res.status(400).json({ message: 'Il nome è obbligatorio e non può essere vuoto.' });
    }

    // VALIDAZIONE: Password (minimo 1 carattere non spazio)
    if (trimmedPassword.length === 0) {
        return res.status(400).json({ message: 'La password è obbligatoria e deve contenere almeno 1 carattere.' });
    }

    try {
        // 1. Verificare se l'utente esiste già
        // Usa l'email pulita per la query
        const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
        if (existingUsers.length > 0) {
            // Conflitto: l'email esiste già
            return res.status(409).json({ message: 'Questa email è già registrata.' });
        }

        // 2. Hashing sicuro della password
        // saltRounds è definito all'inizio del file
        const hashedPassword = await bcrypt.hash(trimmedPassword, saltRounds); 
        
        // 3. Inserimento del nuovo utente (role='user' di default)
        const [result] = await connection.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', 
            // Inserisce i valori puliti e l'hash
            [trimmedName, trimmedEmail, hashedPassword] 
        );
        
        // Successo: l'API risponde con un codice 201 (Created)
        res.status(201).json({ 
            message: 'Registrazione completata con successo.', 
            userId: result.insertId 
        });

    } catch (error) {
        // Gestione di eventuali errori del DB o del server
        console.error('Errore durante la registrazione:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});


// ROUTE: LOGIN UTENTE (/api/login)
app.post('/api/login', async (req, res) => {
    // Estrae i dati inviati dal frontend
    const { email, password } = req.body;

    // Pulisce gli input da spazi bianchi iniziali/finali
    const trimmedEmail = email ? email.trim() : '';
    const trimmedPassword = password ? password.trim() : '';

    // 1. Controllo di base: presenza dei campi
    if (!trimmedEmail || !trimmedPassword) {
        return res.status(400).json({ message: 'Email e password sono obbligatorie.' });
    }

    // 2. Validazione: Password (minimo 1 carattere non spazio)
    if (trimmedPassword.length === 0) {
        // Blocca le password vuote o composte solo da spazi
        return res.status(400).json({ message: 'La password è obbligatoria e deve contenere almeno 1 carattere.' });
    }

    try {
        // 3. Cerca l'utente per email
        // Usa l'email pulita per la query
        const [users] = await connection.query(
            'SELECT id, password_hash, role FROM users WHERE email = ?',
            [trimmedEmail] // Usa l'email pulita
        );

        const user = users[0];

        // 4. Verifica se l'utente esiste
        if (!user) {
            // Non specificare se è l'email o la password ad essere sbagliata per motivi di sicurezza
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        // 5. Confronta la password fornita con l'hash salvato (usando Bcrypt)
        // Usa la password pulita per il confronto
        const match = await bcrypt.compare(trimmedPassword, user.password_hash);

        if (!match) {
            // Password errata
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        // 6. Login di Successo: restituisce dati essenziali
        res.status(200).json({
            message: 'Accesso effettuato con successo.',
            userId: user.id,
            role: user.role,
        });

    } catch (error) {
        // Gestione di eventuali errori del DB o del server
        console.error('Errore durante il login:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: CREAZIONE TICKET (POST /api/tickets)
app.post('/api/tickets', async (req, res) => {
    // Il frontend invierà: title, description, priority, e userId
    const { user_id, title, description, priority } = req.body;

    if (!user_id || !title || !description || !priority) {
        return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' });
    }
    
    // Verifichiamo che la priorità sia valida, sebbene i campi ENUM del DB lo facciano già, è buona pratica
    if (!['bassa', 'media', 'alta'].includes(priority)) {
        return res.status(400).json({ message: 'Valore di priorità non valido.' });
    }

    try {
        const insertQuery = `
            INSERT INTO tickets (user_id, title, description, priority) 
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await connection.query(insertQuery, [user_id, title, description, priority]);

        res.status(201).json({ 
            message: 'Ticket creato con successo.', 
            ticketId: result.insertId 
        });

    } catch (error) {
        console.error('Errore durante la creazione del ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO TICKET PER UTENTE (GET /api/tickets/:userId)
app.get('/api/tickets/:userId', async (req, res) => {
    // Estrae l'ID utente dall'URL
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ message: 'ID utente mancante.' });
    }

    try {
        // Query per selezionare tutti i ticket per un dato user_id
        const selectQuery = `
            SELECT id, title, description, priority, status, created_at
            FROM tickets
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        const [tickets] = await connection.query(selectQuery, [userId]);

        // Successo: restituisce la lista dei ticket (anche se è vuota)
        res.status(200).json(tickets);

    } catch (error) {
        console.error('Errore durante il recupero dei ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO DI TUTTI I TICKET (GET /api/all-tickets)
app.get('/api/all-tickets', async (req, res) => {
    try {
        // Query per selezionare TUTTI i ticket, unendo le informazioni dell'utente
        // Usiamo un JOIN per avere nome ed email dell'utente che ha aperto il ticket
        const selectQuery = `
            SELECT 
                t.id, t.title, t.description, t.priority, t.status, t.created_at, 
                u.name AS user_name, u.email AS user_email
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `;
        const [tickets] = await connection.query(selectQuery);

        res.status(200).json(tickets);

    } catch (error) {
        console.error('Errore durante il recupero di tutti i ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: AGGIORNAMENTO STATO TICKET (PUT /api/tickets/:id)
app.put('/api/tickets/:id', async (req, res) => {
    const ticketId = req.params.id;
    // Il frontend invierà solo il nuovo stato nel corpo della richiesta
    const { status } = req.body; 

    if (!status) {
        return res.status(400).json({ message: 'Stato mancante.' });
    }
    
    // Validazione dello stato
    const validStatuses = ['In attesa', 'In lavorazione', 'Risolto'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Valore di stato non valido.' });
    }

    try {
        const updateQuery = `
            UPDATE tickets
            SET status = ?
            WHERE id = ?
        `;
        const [result] = await connection.query(updateQuery, [status, ticketId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ticket non trovato.' });
        }

        res.status(200).json({ message: 'Stato del ticket aggiornato con successo.' });

    } catch (error) {
        console.error('Errore durante l\'aggiornamento del ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: ELIMINAZIONE TICKET (DELETE /api/tickets/:id)
app.delete('/api/tickets/:ticketId', async (req, res) => {
    const ticketId = req.params.ticketId;

    try {
        // 1. RECUPERA i dati del ticket (incluso il nome utente) prima dell'eliminazione
        const [ticketData] = await connection.query(`
            SELECT t.id, t.user_id, t.title, t.description, t.priority, t.status, u.name as user_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [ticketId]);

        if (ticketData.length === 0) {
            return res.status(404).json({ message: 'Ticket non trovato.' });
        }
        const ticket = ticketData[0];

        // 2. INSERISCI i dati del ticket nella tabella storico (deleted_tickets)
        await connection.query(`
            INSERT INTO deleted_tickets (original_id, original_user_id, original_user_name, title, description, priority, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            ticket.id,
            ticket.user_id,
            ticket.user_name,
            ticket.title,
            ticket.description,
            ticket.priority,
            ticket.status
        ]);

        // 3. ELIMINA il ticket dalla tabella principale
        const [result] = await connection.query('DELETE FROM tickets WHERE id = ?', [ticketId]);
        res.status(200).json({ message: 'Ticket eliminato con successo e salvato nello storico.' });

    } catch (error) {
        console.error('Errore durante l\'eliminazione del ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: CREAZIONE NUOVA NOTA (POST /api/notes)
app.post('/api/notes', async (req, res) => {
    // Estraiamo i campi, dal frontend arriva ancora come user_id
    const ticketId = parseInt(req.body.ticket_id);
    const adminId = parseInt(req.body.user_id); // Lo riceviamo come user_id dal frontend, ma lo useremo come admin_id nel DB
    const content = req.body.content;

    if (!ticketId || !adminId || !content) {
        return res.status(400).json({ message: 'Campi obbligatori mancanti o non validi per la nota.' });
    }

    try {
        const insertQuery = `
            INSERT INTO notes (ticket_id, admin_id, content)  
            VALUES (?, ?, ?)
        `;
        
        const [result] = await connection.query(insertQuery, [ticketId, adminId, content]);

        res.status(201).json({ 
            message: 'Nota aggiunta con successo.', 
            noteId: result.insertId 
        });

    } catch (error) {
        console.error('ERRORE CRITICO DB durante l\'aggiunta della nota:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO NOTE PER TICKET (GET /api/tickets/:ticketId/notes)
app.get('/api/tickets/:ticketId/notes', async (req, res) => {
    const ticketId = req.params.ticketId;

    try {
        // La query recupera la nota e il nome dell'admin che l'ha scritta
        const selectQuery = `
            SELECT 
                n.content, 
                n.created_at, 
                u.name AS admin_name
            FROM notes n
            JOIN users u ON n.admin_id = u.id
            WHERE n.ticket_id = ?
            ORDER BY n.created_at DESC
        `;
        const [notes] = await connection.query(selectQuery, [ticketId]);

        res.status(200).json(notes);

    } catch (error) {
        console.error(`Errore durante il recupero delle note per il ticket ${ticketId}:`, error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

//GESTIONE UTENTI)
// ROUTE: CONTEGGIO UTENTI REGISTRATI (GET /api/users/count)
app.get('/api/users/count', async (req, res) => {
    try {
        // Conta solo gli utenti con ruolo 'user'
        const query = "SELECT COUNT(id) AS userCount FROM users WHERE role = 'user'";
        const [rows] = await connection.query(query);
        res.status(200).json({ count: rows[0].userCount });
    } catch (error) {
        console.error('Errore durante il conteggio degli utenti:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO LISTA UTENTI (GET /api/users)
app.get('/api/users', async (req, res) => {
    try {
        // Seleziona tutti gli utenti che NON sono Admin
        const query = "SELECT id, name, email, created_at FROM users WHERE role = 'user' ORDER BY id ASC";
        const [users] = await connection.query(query);
        // Restituisce la lista (anche se vuota)
        res.status(200).json(users); 
    } catch (error) {
        // Se c'è un errore SQL, viene loggato qui
        console.error('Errore durante il recupero degli utenti:', error); 
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO DETTAGLI SINGOLO UTENTE (GET /api/users/:userId)
app.get('/api/users/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        // Selezioniamo solo i campi non sensibili (nome ed email) per popolare il form
        const [users] = await connection.query('SELECT name, email FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'Utente non trovato.' });
        }

        // Restituisce l'oggetto utente contenente nome ed email
        res.status(200).json(users[0]);
    } catch (error) {
        console.error('Errore durante il recupero del profilo utente:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: ELIMINAZIONE UTENTE (DELETE /api/users/:userId)
app.delete('/api/users/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        // Controllo di sicurezza: impedisce di eliminare l'admin (se fosse necessario)
        const [userCheck] = await connection.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (userCheck.length === 0 || userCheck[0].role === 'admin') {
            return res.status(403).json({ message: 'Non puoi eliminare questo utente o non esiste.' });
        }
        
        // La cancellazione del ticket viene gestita automaticamente dalla clausola ON DELETE CASCADE
        const deleteQuery = 'DELETE FROM users WHERE id = ?';
        const [result] = await connection.query(deleteQuery, [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Utente non trovato.' });
        }

        res.status(200).json({ message: 'Utente eliminato con successo.' });
    } catch (error) {
        console.error('Errore durante l\'eliminazione dell\'utente:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: RECUPERO GLI ULTIMI 3 TICKET ELIMINATI)
app.get('/api/history/deleted-tickets', async (req, res) => {
    try {
        const query = `
            SELECT original_id, original_user_name, title, description, deleted_at 
            FROM deleted_tickets
            ORDER BY deleted_at DESC
            LIMIT 3
        `;
        const [history] = await connection.query(query);
        res.status(200).json(history);
    } catch (error) {
        console.error('Errore durante il recupero dello storico ticket:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// ROUTE: AGGIORNAMENTO PROFILO UTENTE)
app.put('/api/users/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { name, email, newPassword } = req.body;
    let queryParts = [];
    let queryValues = [];
    
    // 1. VALIDAZIONE UNIQUENESS EMAIL
    if (email) {
        try {
            const [existingUser] = await connection.query(
                'SELECT id FROM users WHERE email = ? AND id != ?', 
                [email, userId]
            );
            if (existingUser.length > 0) {
                return res.status(409).json({ message: 'L\'email è già utilizzata da un altro utente.' });
            }
            queryParts.push('email = ?');
            queryValues.push(email);
        } catch (error) {
            console.error('Errore durante la verifica dell\'email:', error);
            return res.status(500).json({ message: 'Errore interno del server durante la validazione dell\'email.' });
        }
    }
    
    // 2. AGGIORNAMENTO CAMPI (esclusa password)
    if (name) {
        queryParts.push('name = ?');
        queryValues.push(name);
    }

    // 3. AGGIORNAMENTO PASSWORD (se fornita)
    if (newPassword) {
        // VALIDAZIONE
        // Controlla che sia una stringa e che non sia vuota (lunghezza > 0)
        if (typeof newPassword !== 'string' || newPassword.trim().length === 0) {
             return res.status(400).json({ message: 'La password non è valida. Deve contenere almeno un carattere.' });
        }
        
        try {
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            queryParts.push('password_hash = ?');
            queryValues.push(hashedPassword);
        } catch (error) {
            console.error('Errore durante l\'hashing della password:', error);
            return res.status(500).json({ message: 'Errore interno del server durante l\'hashing della password.' });
        }
    }

    // 4. ESECUZIONE AGGIORNAMENTO
    if (queryParts.length === 0) {
        return res.status(400).json({ message: 'Nessun campo valido fornito per l\'aggiornamento.' });
    }

    const updateQuery = `UPDATE users SET ${queryParts.join(', ')} WHERE id = ?`;
    queryValues.push(userId);

    try {
        const [result] = await connection.query(updateQuery, queryValues);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Utente non trovato o nessun campo aggiornato.' });
        }
        res.status(200).json({ message: 'Profilo aggiornato con successo.' });
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del profilo:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

// Avvia il server
app.listen(PORT, async () => {
    console.log(`Server API in ascolto sulla porta ${PORT}`);
    await initializeDatabase();
});