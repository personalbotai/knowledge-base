const knowledgeBase = {
    notes: [],
    index: null,
    darkMode: false,
    
    init() {
        this.loadDarkMode();
        this.notes = this.loadNotes();
        this.index = this.buildIndex();
        this.setupEventListeners();
        this.renderNotes();
        this.updateTagFilter();
        this.setupKeyboardShortcuts();
        this.registerServiceWorker();
        this.setupInstallPrompt();
    },
    
    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install button or hint
            const existingHint = document.querySelector('.install-hint');
            if (existingHint) existingHint.remove();
            
            const hint = document.createElement('div');
            hint.className = 'install-hint';
            hint.innerHTML = `
                <button id="installBtn" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
                    📱 Install App
                </button>
            `;
            document.querySelector('header').appendChild(hint);
            
            document.getElementById('installBtn').addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('User response:', outcome);
                    deferredPrompt = null;
                    hint.remove();
                }
            });
        });
        
        // Hide install hint if app is already installed
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            const hint = document.querySelector('.install-hint');
            if (hint) hint.remove();
        });
    },
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/knowledge-base/sw.js')
                    .then(reg => {
                        console.log('Service Worker registered:', reg);
                        // Check for updates every 6 hours
                        setInterval(() => {
                            reg.update();
                        }, 6 * 60 * 60 * 1000);
                    })
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }
    },
    
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const addNoteForm = document.getElementById('addNoteForm');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFileInput = document.getElementById('importFileInput');
        const tagFilter = document.getElementById('tagFilter');

        // Search with debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchNotes(e.target.value);
            }, 200);
        });

        // Add note
        addNoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNote();
        });

        // Dark mode toggle
        darkModeToggle.addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Export
        exportBtn.addEventListener('click', () => {
            this.showExportMenu();
        });

        // Import
        importBtn.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importNotes(e.target.files[0]);
            }
        });

        // Tag filter
        tagFilter.addEventListener('change', (e) => {
            this.filterByTag(e.target.value);
        });
    },
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K for search focus
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            // Ctrl+N for new note focus
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                document.getElementById('noteTitle').focus();
            }
        });
    },
    
    loadDarkMode() {
        const saved = localStorage.getItem('darkMode');
        if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            this.darkMode = true;
            document.documentElement.classList.add('dark');
            this.updateDarkModeIcon();
        }
    },
    
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', this.darkMode);
        this.updateDarkModeIcon();
    },
    
    updateDarkModeIcon() {
        const moonIcon = document.getElementById('moonIcon');
        const sunIcon = document.getElementById('sunIcon');
        if (this.darkMode) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    },
    
    loadNotes() {
        const stored = localStorage.getItem('knowledgeBaseNotes');
        return stored ? JSON.parse(stored) : [];
    },
    
    saveNotes() {
        localStorage.setItem('knowledgeBaseNotes', JSON.stringify(this.notes));
    },
    
    buildIndex() {
        if (this.notes.length === 0) return null;
        
        const idx = lunr(function () {
            this.ref('id');
            this.field('title');
            this.field('content');
            this.field('tags');
            
            this.notes.forEach(note => this.add(note));
        });
        return idx;
    },
    
    addNote() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        const tagsInput = document.getElementById('noteTags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        if (!title || !content) return;

        // Process note linking: [[note title]] -> link
        const processedContent = this.processNoteLinking(content);

        const newNote = {
            id: Date.now().toString(),
            title: title,
            content: processedContent,
            tags: tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(newNote);
        this.saveNotes();
        this.index = this.buildIndex();
        this.renderNotes();
        this.updateTagFilter();
        
        document.getElementById('addNoteForm').reset();
        this.showMessage('Note added successfully!');
    },
    
    processNoteLinking(content) {
        // Convert [[Note Title]] to clickable link that searches for that note
        return content.replace(/\[\[([^\]]+)\]\]/g, (match, noteTitle) => {
            return `<a href="#" class="note-link text-indigo-600 dark:text-indigo-400 hover:underline" data-note-title="${this.escapeHtml(noteTitle)}">${this.escapeHtml(noteTitle)}</a>`;
        });
    },
    
    renderNotes(notes = this.notes) {
        const notesGrid = document.getElementById('notesGrid');
        
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                    <h3 class="text-xl font-semibold mb-2">No notes yet</h3>
                    <p class="text-gray-600 dark:text-gray-500">Start adding your knowledge by creating your first note!</p>
                </div>
            `;
            return;
        }

        notesGrid.innerHTML = notes.map(note => `
            <div class="note-card bg-indigo-50 dark:bg-gray-700 border-l-4 border-indigo-500 p-4 rounded-lg hover:shadow-md transition-shadow" data-id="${note.id}">
                <h3 class="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-2">${this.escapeHtml(note.title)}</h3>
                <div class="note-content text-gray-600 dark:text-gray-300 mb-3">${this.renderMarkdown(note.content)}</div>
                ${note.tags.length ? `
                    <div class="note-tags flex flex-wrap gap-2 mb-2">
                        ${note.tags.map(tag => `
                            <span class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded text-xs">${this.escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="flex gap-2">
                    <button class="edit-btn bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600 text-sm" onclick="knowledgeBase.editNote('${note.id}')">Edit</button>
                    <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm" onclick="knowledgeBase.deleteNote('${note.id}')">Delete</button>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    ${new Date(note.updatedAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        // Add event listeners for note links
        notesGrid.querySelectorAll('.note-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const title = e.target.dataset.noteTitle;
                this.searchNotes(title);
                document.getElementById('searchInput').value = title;
            });
        });
    },
    
    renderMarkdown(content) {
        // First, process note linking, then parse markdown
        const withLinks = this.processNoteLinking(content);
        const rawHtml = marked.parse(withLinks);
        return DOMPurify.sanitize(rawHtml);
    },
    
    searchNotes(query) {
        if (!query) {
            this.renderNotes();
            this.tagFilter.value = '';
            return;
        }

        // Check if query matches a tag
        const tagMatch = query.toLowerCase().startsWith('tag:');
        if (tagMatch) {
            const tag = query.substring(4).trim();
            this.filterByTag(tag);
            return;
        }

        // First, filter by tag if tag filter is active
        let filteredNotes = this.notes;
        const activeTag = document.getElementById('tagFilter').value;
        if (activeTag) {
            filteredNotes = this.notes.filter(note => note.tags.includes(activeTag));
        }

        // Then search with Lunr
        if (this.index) {
            const results = this.index.search(query).map(result => 
                filteredNotes.find(note => note.id === result.ref)
            ).filter(Boolean);
            this.renderNotes(results);
        } else {
            // Fallback to simple text search
            const lowerQuery = query.toLowerCase();
            const results = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(lowerQuery) || 
                note.content.toLowerCase().includes(lowerQuery)
            );
            this.renderNotes(results);
        }
    },
    
    filterByTag(tag) {
        document.getElementById('tagFilter').value = tag;
        if (!tag) {
            this.renderNotes();
            return;
        }
        const filtered = this.notes.filter(note => note.tags.includes(tag));
        this.renderNotes(filtered);
    },
    
    updateTagFilter() {
        const tagFilter = document.getElementById('tagFilter');
        const allTags = new Set();
        this.notes.forEach(note => note.tags.forEach(tag => allTags.add(tag)));
        
        tagFilter.innerHTML = '<option value="">All Tags</option>' +
            Array.from(allTags).sort().map(tag => 
                `<option value="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</option>`
            ).join('');
    },
    
    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;

        const title = prompt('Edit title:', note.title);
        if (title === null) return;
        
        const content = prompt('Edit content (Markdown):', note.content);
        if (content === null) return;
        
        const tagsInput = prompt('Edit tags (comma separated):', note.tags.join(', '));
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        note.title = title.trim();
        note.content = this.processNoteLinking(content.trim());
        note.tags = tags;
        note.updatedAt = new Date().toISOString();
        
        this.saveNotes();
        this.index = this.buildIndex();
        this.renderNotes();
        this.updateTagFilter();
        
        this.showMessage('Note updated successfully!');
    },
    
    deleteNote(id) {
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        this.notes = this.notes.filter(n => n.id !== id);
        this.saveNotes();
        this.index = this.buildIndex();
        this.renderNotes();
        this.updateTagFilter();
        this.showMessage('Note deleted!');
    },
    
    showExportMenu() {
        const options = [
            { label: 'Export as JSON', action: () => this.exportJSON() },
            { label: 'Export as Markdown', action: () => this.exportMarkdown() },
            { label: 'Export as PDF', action: () => this.exportPDF() },
        ];
        
        // Simple prompt-based menu (could be improved with custom dropdown)
        const choice = prompt(
            'Export options:\n' +
            '1. JSON\n' +
            '2. Markdown\n' +
            '3. PDF (print)\n' +
            'Enter number:'
        );
        
        if (choice === '1') this.exportJSON();
        else if (choice === '2') this.exportMarkdown();
        else if (choice === '3') this.exportPDF();
    },
    
    exportJSON() {
        const data = JSON.stringify(this.notes, null, 2);
        this.downloadFile(data, 'knowledge-base.json', 'application/json');
        this.showMessage('Exported as JSON!');
    },
    
    exportMarkdown() {
        const md = this.notes.map(note => {
            const tags = note.tags.length ? `\n**Tags:** ${note.tags.join(', ')}` : '';
            return `# ${note.title}\n\n${note.content}${tags}\n\n---\n`;
        }).join('\n');
        this.downloadFile(md, 'knowledge-base.md', 'text/markdown');
        this.showMessage('Exported as Markdown!');
    },
    
    exportPDF() {
        window.print();
    },
    
    importNotes(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                let importedNotes = [];
                
                if (file.name.endsWith('.json')) {
                    importedNotes = JSON.parse(content);
                    if (!Array.isArray(importedNotes)) throw new Error('Invalid JSON format');
                } else if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                    importedNotes = this.parseMarkdownImport(content);
                } else {
                    throw new Error('Unsupported file type');
                }
                
                // Validate and process notes
                importedNotes = importedNotes.map(note => ({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    title: note.title || 'Untitled',
                    content: this.processNoteLinking(note.content || ''),
                    tags: Array.isArray(note.tags) ? note.tags : (note.tags ? note.tags.split(',').map(t => t.trim().toLowerCase()) : []),
                    createdAt: note.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }));
                
                if (confirm(`Import ${importedNotes.length} notes? Existing notes with same title will be skipped.`)) {
                    const existingTitles = new Set(this.notes.map(n => n.title.toLowerCase()));
                    let imported = 0;
                    let skipped = 0;
                    
                    importedNotes.forEach(note => {
                        if (!existingTitles.has(note.title.toLowerCase())) {
                            this.notes.push(note);
                            imported++;
                        } else {
                            skipped++;
                        }
                    });
                    
                    this.saveNotes();
                    this.index = this.buildIndex();
                    this.renderNotes();
                    this.updateTagFilter();
                    this.showMessage(`Imported ${imported} notes, skipped ${skipped} duplicates.`);
                }
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    },
    
    parseMarkdownImport(content) {
        // Parse markdown files with optional frontmatter or simple headers
        const notes = [];
        const blocks = content.split(/\n---\n/);
        
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            if (lines.length >= 2 && lines[0].startsWith('# ')) {
                const title = lines[0].substring(2).trim();
                const body = lines.slice(1).join('\n').trim();
                
                // Extract tags if present (e.g., **Tags:** tag1, tag2)
                let tags = [];
                const tagMatch = body.match(/\*\*Tags:\*\*\s*(.+)/);
                if (tagMatch) {
                    tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase());
                    // Remove the tag line from content
                    const contentWithoutTags = body.replace(/\*\*Tags:\*\*\s*.+\n?/, '').trim();
                    notes.push({ title, content: contentWithoutTags, tags });
                } else {
                    notes.push({ title, content: body, tags: [] });
                }
            }
        });
        
        return notes;
    },
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
            transition: opacity 0.3s;
        `;

        document.body.appendChild(msg);
        
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, 3000);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

knowledgeBase.init();