# Personal Knowledge Base 🧠

A lightweight, client-side personal knowledge base with markdown support, tags, and full-text search. Deployable to GitHub Pages.

## Features

- ✨ **Markdown Support**: Write notes in Markdown with live preview
- 🏷️ **Tags**: Organize notes with multiple tags and filter by tag
- 🔍 **Full-Text Search**: Powered by Lunr.js with instant results
- 🌓 **Dark Mode**: Toggle between light and dark themes
- 📤 **Import/Export**: JSON, Markdown, and PDF (print) export
- 🔗 **Note Linking**: Create links between notes with `[[Note Title]]`
- ⌨️ **Keyboard Shortcuts**: 
  - `Ctrl+K` / `Cmd+K`: Focus search
  - `Ctrl+N` / `Cmd+N`: Focus new note title
- 📱 **Responsive**: Works on desktop and mobile
- 💾 **LocalStorage**: All data stored locally in your browser

## Getting Started

### Deploy to GitHub Pages

1. Fork this repository
2. Go to repository Settings → Pages
3. Source: select `main` branch and `/root` folder
4. Save. Your site will be live at `https://<username>.github.io/knowledge-base`

### Local Development

Simply open `index.html` in a browser. No build process required.

## Usage

### Creating Notes

1. Fill in the title and content in the right panel
2. Optional: add tags separated by commas (e.g., "programming, go, ai")
3. Click "Add Note" or press Enter

### Markdown

The content field supports full Markdown:

```markdown
# Heading 1
## Heading 2

- List item 1
- List item 2

**bold** *italic* `code`

[Link text](https://example.com)
```

### Note Linking

Link to other notes by using double brackets:

```
Check out [[My Other Note]] for more details.
```

Clicking the link will search for that note title.

### Searching

- Type in the search box to filter notes
- Search matches titles, content, and tags
- To filter by tag only, type `tag:tagname`
- Use `Ctrl+K` to quickly focus the search box

### Tag Filter

Use the dropdown in the "My Notes" section to show only notes with a specific tag.

### Import & Export

**Export:**
- Click the export button (↑) in the top right
- Choose JSON (all data), Markdown (text files), or PDF (print)

**Import:**
- Click the import button (↓)
- Select a `.json` or `.md` file
- Duplicate titles are skipped

### Dark Mode

Click the moon/sun icon to toggle dark mode. Preference is saved automatically.

## Data Structure

Notes are stored in browser localStorage under key `knowledgeBaseNotes`. Each note has:

```json
{
  "id": "unique-id",
  "title": "Note Title",
  "content": "Markdown content with [[links]]",
  "tags": ["tag1", "tag2"],
  "createdAt": "2024-02-22T10:30:00.000Z",
  "updatedAt": "2024-02-22T10:30:00.000Z"
}
```

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript
- LocalStorage
- IndexedDB (optional for future PWA)

## Roadmap

- [ ] PWA with offline support
- [ ] Cloud sync (Firebase/Supabase)
- [ ] Rich text editor
- [ ] Graph view of note relationships
- [ ] Mobile app wrapper

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT

---

Made with ❤️ by PicoClaw