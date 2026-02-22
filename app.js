const knowledgeBase = {
    notes: [],
    index: null,
    darkMode: false,
    currentEditId: null,

    init() {
        this.loadDarkMode();
        this.notes = this.loadNotes();
        this._memoryNotes = this.notes;
        this.index = null;
        this._rebuildIndexTimeout = null;
        this.setupEventListeners();
        this.renderNotes();
        this.updateTagFilter();
        this.setupKeyboardShortcuts();
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.debouncedRebuildIndex();
    },

    setupInstallPrompt() {
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
        });
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => {
                        console.log('Service Worker registered:', reg);
                        setInterval(() => reg.update(), 6 * 60 * 60 * 1000);
                    })
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }
    },

    setupEventListeners() {
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(this._searchTimeout);
            this._searchTimeout = setTimeout(() => {
                this.searchNotes(e.target.value);
            }, 200);
        });

        // Quick add button (header)
        document.getElementById('quickAddBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Empty state add button
        document.getElementById('emptyAddBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importNotes(e.target.files[0]);
            }
        });

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('cancelModal').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('saveNote').addEventListener('click', () => {
            this.saveNoteFromModal();
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Tag filter
        document.getElementById('tagFilter').addEventListener('change', (e) => {
            this.filterByTag(e.target.value);
        });

        // Character count
        const textarea = document.getElementById('modalNoteContent');
        textarea.addEventListener('input', (e) => {
            const count = e.target.value.length;
            document.getElementById('charCount').textContent = `${count} characters`;
        });
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.openModal();
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
        try {
            const stored = localStorage.getItem('knowledgeBaseNotes');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.warn('localStorage unavailable, using memory storage:', e);
            return this._memoryNotes || [];
        }
    },

    saveNotes() {
        try {
            localStorage.setItem('knowledgeBaseNotes', JSON.stringify(this.notes));
            this._memoryNotes = this.notes;
        } catch (e) {
            console.warn('localStorage write failed, storing in memory only:', e);
            this._memoryNotes = this.notes;
        }
    },

    debouncedRebuildIndex() {
        if (this._rebuildIndexTimeout) clearTimeout(this._rebuildIndexTimeout);
        this._rebuildIndexTimeout = setTimeout(() => {
            this.index = this.buildIndex();
        }, 500);
    },

    buildIndex() {
        if (this.notes.length === 0) return null;
        try {
            const idx = lunr(function () {
                this.ref('id');
                this.field('title');
                this.field('content');
                this.field('tags');
                this.notes.forEach(note => this.add(note));
            });
            return idx;
        } catch (e) {
            console.error('Failed to build lunr index:', e);
            return null;
        }
    },

    openModal(note = null) {
        const modal = document.getElementById('noteModal');
        const titleEl = document.getElementById('modalTitle');
        const titleInput = document.getElementById('modalNoteTitle');
        const tagsInput = document.getElementById('modalNoteTags');
        const contentInput = document.getElementById('modalNoteContent');
        const charCount = document.getElementById('charCount');

        if (note) {
            titleEl.textContent = 'Edit Note';
            titleInput.value = note.title;
            tagsInput.value = note.tags.join(', ');
            contentInput.value = note.content.replace(/<a[^>]*data-note-title[^>]*>([^<]*)<\/a>/g, '[[$1]]');
            this.currentEditId = note.id;
        } else {
            titleEl.textContent = 'New Note';
            titleInput.value = '';
            tagsInput.value = '';
            contentInput.value = '';
            this.currentEditId = null;
        }

        charCount.textContent = `${contentInput.value.length} characters`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        titleInput.focus();
    },

    closeModal() {
        const modal = document.getElementById('noteModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this.currentEditId = null;
    },

    saveNoteFromModal() {
        const title = document.getElementById('modalNoteTitle').value.trim();
        const content = document.getElementById('modalNoteContent').value.trim();
        const tagsInput = document.getElementById('modalNoteTags').value.trim();

        if (!title) {
            this.showMessage('Please enter a title', 'error');
            return;
        }
        if (!content) {
            this.showMessage('Please enter some content', 'error');
            return;
        }
        if (title.length > 200) {
            this.showMessage('Title is too long (max 200 characters)', 'error');
            return;
        }
        if (content.length > 10000) {
            this.showMessage('Content is too long (max 10000 characters)', 'error');
            return;
        }

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
        const processedContent = this.processNoteLinking(content);

        if (this.currentEditId) {
            const note = this.notes.find(n => n.id === this.currentEditId);
            if (note) {
                note.title = title;
                note.content = processedContent;
                note.tags = tags;
                note.updatedAt = new Date().toISOString();
                this.showMessage('Note updated successfully!');
            }
        } else {
            const newNote = {
                id: Date.now().toString(),
                title: title,
                content: processedContent,
                tags: tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.notes.unshift(newNote);
            this.showMessage('Note added successfully!');
        }

        this.saveNotes();
        this.debouncedRebuildIndex();
        this.renderNotes();
        this.updateTagFilter();
        this.closeModal();
    },

    processNoteLinking(content) {
        return content.replace(/\[\[([^\]]+)\]\]/g, (match, noteTitle) => {
            return `<a href="#" class="note-link text-indigo-600 dark:text-indigo-400 hover:underline" data-note-title="${this.escapeHtml(noteTitle)}">${this.escapeHtml(noteTitle)}</a>`;
        });
    },

    renderNotes(notes = this.notes) {
        const notesGrid = document.getElementById('notesGrid');
        const emptyState = document.getElementById('emptyState');

        if (notes.length === 0) {
            notesGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        notesGrid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        notesGrid.innerHTML = notes.map(note => `
            <div class="note-card" data-id="${note.id}">
                <h3>${this.escapeHtml(note.title)}</h3>
                <div class="note-content">${this.renderMarkdown(note.content)}</div>
                ${note.tags.length ? `
                    <div class="note-tags">
                        ${note.tags.map(tag => `
                            <span class="note-tag">${this.escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="flex gap-2 mt-4">
                    <button class="edit-btn px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors" onclick="knowledgeBase.editNote('${note.id}')">Edit</button>
                    <button class="delete-btn px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors" onclick="knowledgeBase.deleteNote('${note.id}')">Delete</button>
                </div>
                <div class="note-date mt-2">
                    ${new Date(note.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
            </div>
        `).join('');

        notesGrid.querySelectorAll('.note-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const title = e.target.dataset.noteTitle;
                document.getElementById('searchInput').value = title;
                this.searchNotes(title);
            });
        });
    },

    renderMarkdown(content) {
        const withLinks = this.processNoteLinking(content);
        const rawHtml = marked.parse(withLinks);
        return DOMPurify.sanitize(rawHtml);
    },

    searchNotes(query) {
        if (!query) {
            this.renderNotes();
            document.getElementById('tagFilter').value = '';
            return;
        }

        if (query.toLowerCase().startsWith('tag:')) {
            const tag = query.substring(4).trim();
            this.filterByTag(tag);
            return;
        }

        let filteredNotes = this.notes;
        const activeTag = document.getElementById('tagFilter').value;
        if (activeTag) {
            filteredNotes = this.notes.filter(note => note.tags.includes(activeTag));
        }

        if (this.index) {
            const results = this.index.search(query).map(result => 
                filteredNotes.find(note => note.id === result.ref)
            ).filter(Boolean);
            this.renderNotes(results);
        } else {
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
        document.getElementById('searchInput').value = '';
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
        if (note) {
            this.openModal(note);
        }
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
                    let imported = 0, skipped = 0;
                    
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
        const notes = [];
        let blocks = content.split(/\n---\n/);
        if (blocks.length === 1) {
            blocks = content.split(/\n\s*\n\s*\n/);
        }

        blocks.forEach(block => {
            block = block.trim();
            if (!block) return;

            let title = '';
            let body = '';
            let tags = [];

            const frontmatterMatch = block.match(/^---\n([\s\S]*?)\n---\n/);
            let contentBody = block;

            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                contentBody = block.substring(frontmatterMatch[0].length);
                const tagMatch = frontmatter.match(/tags:\s*(.+)/);
                if (tagMatch) {
                    tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase());
                }
            }

            const lines = contentBody.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('# ')) {
                    title = line.substring(2).trim();
                    body = lines.slice(i + 1).join('\n').trim();
                    break;
                }
            }

            if (!title) {
                const firstLine = lines.find(l => l.trim());
                if (firstLine) {
                    title = firstLine.trim();
                    body = lines.slice(lines.indexOf(firstLine) + 1).join('\n').trim();
                } else {
                    title = 'Untitled';
                    body = contentBody;
                }
            }

            if (tags.length === 0) {
                const tagLineMatch = body.match(/\*\*Tags:\*\*\s*(.+)/);
                if (tagLineMatch) {
                    tags = tagLineMatch[1].split(',').map(t => t.trim().toLowerCase());
                    body = body.replace(/\*\*Tags:\*\*\s*.+\n?/, '').trim();
                }
                const hashtagMatches = body.match(/#(\w+)/g);
                if (hashtagMatches) {
                    const hashtagTags = hashtagMatches.map(t => t.substring(1).toLowerCase());
                    tags = [...new Set([...tags, ...hashtagTags])];
                }
            }

            notes.push({
                title: title || 'Untitled',
                content: body || '',
                tags: tags
            });
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

    showMessage(message, type = 'success') {
        const oldMsg = document.querySelector('.message');
        if (oldMsg) oldMsg.remove();

        const msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = message;
        const bgColor = type === 'error' ? '#ef4444' : '#10b981';
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
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

document.addEventListener('DOMContentLoaded', () => {
    knowledgeBase.init();
});
