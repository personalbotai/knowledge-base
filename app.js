const knowledgeBase = {
    notes: [],
    index: null,
    
    init() {
        this.notes = this.loadNotes();
        this.index = this.buildIndex();
        this.setupEventListeners();
        this.renderNotes();
    },
    
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const addNoteForm = document.getElementById('addNoteForm');

        searchInput.addEventListener('input', (e) => {
            this.searchNotes(e.target.value);
        });

        addNoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNote();
        });
    },
    
    loadNotes() {
        const stored = localStorage.getItem('knowledgeBaseNotes');
        return stored ? JSON.parse(stored) : [];
    },
    
    saveNotes() {
        localStorage.setItem('knowledgeBaseNotes', JSON.stringify(this.notes));
    },
    
    buildIndex() {
        const idx = lunr(function () {
            this.ref('id');
            this.field('title');
            this.field('content');
            
            this.notes.forEach(note => this.add(note));
        });
        return idx;
    },
    
    addNote() {
        const title = document.getElementById('noteTitle').value;
        const content = document.getElementById('noteContent').value;
        
        const newNote = {
            id: Date.now().toString(),
            title: title,
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(newNote);
        this.saveNotes();
        this.index = this.buildIndex();
        this.renderNotes();
        
        document.getElementById('addNoteForm').reset();
        this.showMessage('Note added successfully!');
    },
    
    renderNotes(notes = this.notes) {
        const notesGrid = document.getElementById('notesGrid');
        
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <h3 class="text-xl font-semibold mb-2">No notes yet</h3>
                    <p class="text-gray-600">Start adding your knowledge by creating your first note!</p>
                </div>
            `;
            return;
        }

        notesGrid.innerHTML = notes.map(note => `
            <div class="note-card bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg hover:shadow-md transition-shadow">
                <h3 class="text-lg font-semibold text-indigo-900 mb-2">${this.escapeHtml(note.title)}</h3>
                <p class="text-gray-600">${this.escapeHtml(note.content.substring(0, 150))}...</p>
                <button class="edit-btn mt-2 bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm" onclick="knowledgeBase.editNote('${note.id}')">Edit</button>
            </div>
        `).join('');
    },
    
    searchNotes(query) {
        if (!query) {
            this.renderNotes();
            return;
        }

        const results = this.index.search(query).map(result => 
            this.notes.find(note => note.id === result.ref)
        );
        
        this.renderNotes(results);
    },
    
    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;

        const title = prompt('Edit title:', note.title);
        const content = prompt('Edit content:', note.content);

        if (title !== null && content !== null) {
            note.title = title;
            note.content = content;
            note.updatedAt = new Date().toISOString();
            
            this.saveNotes();
            this.index = this.buildIndex();
            this.renderNotes();
            
            this.showMessage('Note updated successfully!');
        }
    },
    
    showMessage(message) {
        const oldMsg = document.querySelector('.message');
        if (oldMsg) oldMsg.remove();

        const msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = message;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
        `;

        document.body.appendChild(msg);
        
        setTimeout(() => {
            msg.remove();
        }, 3000);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

knowledgeBase.init();