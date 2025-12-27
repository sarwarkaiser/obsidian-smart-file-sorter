# Smart File Sorter

Automatically organize your Obsidian vault by moving files into folders based on their properties, tags, and metadata.

## Features

- **Flexible Rule System**: Create custom sorting rules based on:
  - File properties (frontmatter)
  - Tags (both frontmatter and inline tags)
  - Multiple matching types: equals, contains, starts with, ends with, regex
- **Automatic Organization**: Files can be automatically sorted when created or modified
- **Subfolder Support**: Automatically create subfolders based on property values
- **Manual Control**: Sort individual files, folders, or your entire vault with commands
- **Excluded Folders**: Specify folders that should never be auto-sorted
- **Move History**: Track recent file movements for reference
- **Rule Priority**: Rules are evaluated in order, allowing for complex organizational hierarchies

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Smart File Sorter"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/yourusername/obsidian-smart-file-sorter/releases)
2. Extract the files into your vault's `.obsidian/plugins/smart-file-sorter/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Usage

### Setting Up Rules

1. Open Settings → Smart File Sorter
2. Click "Add new rule"
3. Configure your rule:
   - **Rule name**: Give it a descriptive name
   - **Match by**: Choose "Property value" or "Tag"
   - **Property/Tag**: Specify what to match against
   - **Match type**: How to compare values
   - **Destination folder**: Where matching files should move

**Example 1: Organize by Topic**
```yaml
Rule name: Soccer files
Match by: Property value
Property name: topic
Property value: soccer
Match type: Equals
Destination folder: Topics/Soccer
```

When you create a file with:
```yaml
---
topic: soccer
---
```
It will automatically move to `Topics/Soccer/`

**Example 2: Organize by Tags**
```yaml
Rule name: Work notes
Match by: Tag
Tag: work
Match type: Contains
Destination folder: Work
```

Files tagged with `#work` will move to the `Work/` folder.

**Example 3: Subfolder Organization**
```yaml
Rule name: Project files
Match by: Property value
Property name: type
Property value: project
Match type: Equals
Destination folder: Projects
Create subfolders: Yes
Subfolder property: category
```

A file with:
```yaml
---
type: project
category: Website
---
```
Will move to `Projects/Website/`

### Commands

The plugin provides several commands (accessible via Command Palette):

- **Sort current file**: Sort the active file based on rules
- **Sort all files in vault**: Sort all markdown files in your vault
- **Sort files in current folder**: Sort files in the current folder only
- **Sort files in current folder (recursive)**: Sort files in current folder and all subfolders
- **Show move history**: Display recent file movements

### Automatic Sorting

Enable automatic sorting in settings:

1. **Enable automatic sorting**: Master toggle for auto-sorting
2. **Sort on file creation**: Auto-sort when new files are created
3. **Sort on file modification**: Auto-sort when file properties change

You can disable auto-sorting and use manual commands instead for more control.

### Excluded Folders

Specify folders that should never be automatically sorted:

```
Archive
Templates
.trash
Personal/Private
```

Files in these folders will be skipped during automatic sorting.

## Settings

### General Settings

- **Enable automatic sorting**: Turn auto-sorting on/off
- **Sort on file creation**: Auto-sort newly created files
- **Sort on file modification**: Auto-sort when properties change
- **Show notifications**: Display notifications when files are moved
- **Verbose logging**: Enable detailed console logging for debugging

### Sorting Rules

Create and manage your sorting rules:

- Add, edit, delete, and reorder rules
- Enable/disable individual rules
- Rules are evaluated in order (top to bottom)
- First matching rule wins

### Match Types

- **Equals**: Exact match
- **Contains**: Value contains the search term
- **Starts with**: Value starts with the search term
- **Ends with**: Value ends with the search term
- **Regular expression**: Advanced pattern matching

### Case Sensitivity

Toggle case-sensitive matching for each rule independently.

## Best Practices

1. **Start with manual sorting**: Test your rules using manual commands before enabling auto-sort
2. **Use specific rules first**: Place more specific rules higher in the list
3. **Test with examples**: Create test files to verify rule behavior
4. **Exclude template folders**: Add template folders to excluded folders list
5. **Regular backups**: Always maintain vault backups when using automation

## Troubleshooting

### Files aren't moving automatically

- Check that "Enable automatic sorting" is turned on
- Verify the file isn't in an excluded folder
- Ensure at least one rule is enabled and matches the file
- Check if "Sort on file creation/modification" is enabled

### Wrong folder assignment

- Review rule order - rules are evaluated top to bottom
- Check match type and case sensitivity settings
- Use "Sort current file" to test individual files
- Enable verbose logging to see detailed matching info

### Files moving to unexpected locations

- Verify your rules don't have overlapping conditions
- Check subfolder settings if enabled
- Review move history using the "Show move history" command

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-smart-file-sorter.git
cd obsidian-smart-file-sorter

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with hot reload
npm run dev
```

### Project Structure

```
obsidian-smart-file-sorter/
├── main.ts           # Plugin entry point
├── fileSorter.ts     # Core sorting logic
├── settings.ts       # Settings UI
├── types.ts          # TypeScript interfaces
├── manifest.json     # Plugin manifest
├── package.json      # Dependencies
└── README.md         # Documentation
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- Report bugs and request features on [GitHub Issues](https://github.com/yourusername/obsidian-smart-file-sorter/issues)
- Check existing issues before creating new ones
- Provide detailed information for bug reports

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built for the [Obsidian](https://obsidian.md) community
- Inspired by various file organization workflows

## Changelog

### 1.0.0

- Initial release
- Property-based file sorting
- Tag-based file sorting
- Automatic and manual sorting modes
- Subfolder creation support
- Excluded folders
- Move history tracking
- Multiple match types (equals, contains, regex, etc.)
