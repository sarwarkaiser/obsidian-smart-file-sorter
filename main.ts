import { Plugin, TFile, Notice, TFolder } from 'obsidian';
import { SmartFileSorterSettingTab } from './settings';
import { FileSorter } from './fileSorter';
import { PluginSettings, DEFAULT_SETTINGS, MoveOperation } from './types';

export default class SmartFileSorterPlugin extends Plugin {
	settings: PluginSettings;
	fileSorter: FileSorter;
	private processingFiles: Set<string> = new Set();
	private moveHistory: MoveOperation[] = [];

	async onload() {
		await this.loadSettings();

		// Initialize file sorter
		this.fileSorter = new FileSorter(this.app, this.settings.verboseLogging);

		// Add settings tab
		this.addSettingTab(new SmartFileSorterSettingTab(this.app, this));

		// Register commands
		this.registerCommands();

		// Register event handlers for auto-sorting
		this.registerEventHandlers();

		console.log('Smart File Sorter plugin loaded');
	}

	onunload() {
		console.log('Smart File Sorter plugin unloaded');
	}

	private registerCommands(): void {
		// Command: Sort current file
		this.addCommand({
			id: 'sort-current-file',
			name: 'Sort current file',
			callback: () => this.sortCurrentFile()
		});

		// Command: Sort all files in vault
		this.addCommand({
			id: 'sort-all-files',
			name: 'Sort all files in vault',
			callback: () => this.sortAllFiles()
		});

		// Command: Sort current folder
		this.addCommand({
			id: 'sort-current-folder',
			name: 'Sort files in current folder',
			callback: () => this.sortCurrentFolder(false)
		});

		// Command: Sort current folder recursively
		this.addCommand({
			id: 'sort-current-folder-recursive',
			name: 'Sort files in current folder (recursive)',
			callback: () => this.sortCurrentFolder(true)
		});

		// Command: Show move history
		this.addCommand({
			id: 'show-move-history',
			name: 'Show move history',
			callback: () => this.showMoveHistory()
		});

		// Command: Auto-generate rules from vault
		this.addCommand({
			id: 'auto-generate-rules',
			name: 'Auto-generate rules from vault',
			callback: () => this.autoGenerateRules()
		});
	}

	private registerEventHandlers(): void {
		// Handle metadata cache changes (for file modifications)
		// This ensures the frontmatter is parsed before we try to read it
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (
					this.settings.enableAutoSort &&
					this.settings.sortOnModify &&
					file instanceof TFile &&
					file.extension === 'md'
				) {
					this.autoSortFile(file);
				}
			})
		);

		// Handle file creation
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (
					this.settings.enableAutoSort &&
					this.settings.sortOnCreate &&
					file instanceof TFile &&
					file.extension === 'md'
				) {
					// Delay to ensure metadata is loaded
					setTimeout(() => this.autoSortFile(file), 1000);
				}
			})
		);
	}

	private async autoSortFile(file: TFile): Promise<void> {
		// Prevent duplicate processing
		if (this.processingFiles.has(file.path)) {
			return;
		}

		// Check if file is in excluded folder
		if (this.isFileExcluded(file)) {
			return;
		}

		this.processingFiles.add(file.path);

		try {
			const matchingRule = this.fileSorter.findMatchingRule(
				file,
				this.settings.rules
			);

			if (matchingRule) {
				const originalPath = file.path;
				const moved = await this.fileSorter.moveFileByRule(file, matchingRule);

				if (moved) {
					// Record the move
					this.recordMove(file.name, originalPath, file.path, matchingRule.name);

					if (this.settings.showNotifications) {
						new Notice(
							`Moved ${file.name} to ${matchingRule.destinationFolder}`
						);
					}
				}
			}
		} catch (error) {
			console.error('Error auto-sorting file:', error);
		} finally {
			// Remove from processing set after a delay
			setTimeout(() => {
				this.processingFiles.delete(file.path);
			}, 2000);
		}
	}

	private async sortCurrentFile(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		if (activeFile.extension !== 'md') {
			new Notice('Current file is not a markdown file');
			return;
		}

		const matchingRule = this.fileSorter.findMatchingRule(
			activeFile,
			this.settings.rules
		);

		if (!matchingRule) {
			new Notice('No matching rule found for current file');
			return;
		}

		if (!matchingRule.enabled) {
			new Notice(`Matching rule "${matchingRule.name}" is disabled`);
			return;
		}

		const originalPath = activeFile.path;
		const moved = await this.fileSorter.moveFileByRule(activeFile, matchingRule);

		if (moved) {
			this.recordMove(activeFile.name, originalPath, activeFile.path, matchingRule.name);
			new Notice(`Moved to ${matchingRule.destinationFolder}`);
		} else {
			new Notice('File is already in the correct location');
		}
	}

	private async sortAllFiles(): Promise<void> {
		const enabledRules = this.settings.rules.filter(r => r.enabled);

		if (enabledRules.length === 0) {
			new Notice('No enabled sorting rules found');
			return;
		}

		const progressNotice = new Notice('Sorting files...', 0);

		try {
			const result = await this.fileSorter.sortAllFiles(
				this.settings.rules,
				this.settings.excludedFolders,
				(current, total) => {
					progressNotice.setMessage(
						`Sorting files... ${current}/${total}`
					);
				}
			);

			progressNotice.hide();

			const summary = `Sorting complete!\n` +
				`Moved: ${result.moved}\n` +
				`Skipped: ${result.skipped}\n` +
				`Errors: ${result.errors}`;

			new Notice(summary, 5000);
		} catch (error) {
			progressNotice.hide();
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Error sorting files: ${errorMessage}`);
			console.error('Error sorting all files:', error);
		}
	}

	private async sortCurrentFolder(recursive: boolean): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const folder = activeFile.parent;

		if (!folder) {
			new Notice('Cannot determine current folder');
			return;
		}

		const enabledRules = this.settings.rules.filter(r => r.enabled);

		if (enabledRules.length === 0) {
			new Notice('No enabled sorting rules found');
			return;
		}

		try {
			const result = await this.fileSorter.sortFolder(
				folder,
				this.settings.rules,
				recursive
			);

			const recursiveText = recursive ? ' (including subfolders)' : '';
			const summary = `Sorted ${folder.name}${recursiveText}\n` +
				`Moved: ${result.moved}\n` +
				`Skipped: ${result.skipped}\n` +
				`Errors: ${result.errors}`;

			new Notice(summary, 5000);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			new Notice(`Error sorting folder: ${errorMessage}`);
			console.error('Error sorting folder:', error);
		}
	}

	private showMoveHistory(): void {
		if (this.moveHistory.length === 0) {
			new Notice('No move history available');
			return;
		}

		const recentMoves = this.moveHistory.slice(-10).reverse();
		const historyText = recentMoves
			.map(op => {
				const date = new Date(op.timestamp).toLocaleString();
				return `[${date}] ${op.file}\n  ${op.from} → ${op.to}\n  Rule: ${op.rule}`;
			})
			.join('\n\n');

		new Notice(historyText, 10000);
		console.log('Move History:', this.moveHistory);
	}

	private recordMove(
		fileName: string,
		from: string,
		to: string,
		ruleName: string
	): void {
		const operation: MoveOperation = {
			file: fileName,
			from,
			to,
			rule: ruleName,
			timestamp: Date.now()
		};

		this.moveHistory.push(operation);

		// Keep only last 100 moves
		if (this.moveHistory.length > 100) {
			this.moveHistory = this.moveHistory.slice(-100);
		}

		if (this.settings.verboseLogging) {
			console.log('File moved:', operation);
		}
	}

	private async autoGenerateRules(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		const propertyValues = new Map<string, Set<string>>();
		const tags = new Set<string>();

		// Scan all files for properties and tags
		new Notice('Scanning vault for properties and tags...');

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);

			if (cache?.frontmatter) {
				// Collect all property values
				for (const [key, value] of Object.entries(cache.frontmatter)) {
					if (key === 'position' || key === 'tags') continue; // Skip meta properties

					if (!propertyValues.has(key)) {
						propertyValues.set(key, new Set());
					}

					if (value && typeof value === 'string') {
						propertyValues.get(key)!.add(value);
					} else if (Array.isArray(value)) {
						value.forEach(v => {
							if (v && typeof v === 'string') {
								propertyValues.get(key)!.add(v);
							}
						});
					}
				}
			}

			// Collect tags
			if (cache?.tags) {
				cache.tags.forEach(tag => {
					const cleanTag = tag.tag.replace(/^#/, '');
					tags.add(cleanTag);
				});
			}

			// Also get frontmatter tags
			if (cache?.frontmatter?.tags) {
				const fmTags = cache.frontmatter.tags;
				if (Array.isArray(fmTags)) {
					fmTags.forEach(t => tags.add(String(t).replace(/^#/, '')));
				} else if (typeof fmTags === 'string') {
					tags.add(fmTags.replace(/^#/, ''));
				}
			}
		}

		// Generate UUID helper
		const generateUUID = (): string => {
			if (typeof crypto !== 'undefined' && crypto.randomUUID) {
				return crypto.randomUUID();
			}
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
				const r = (Math.random() * 16) | 0;
				const v = c === 'x' ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
		};

		// Generate rules for common properties
		const newRules = [];
		const commonProperties = ['topic', 'category', 'type', 'project', 'status'];

		for (const [propName, values] of propertyValues) {
			if (commonProperties.includes(propName.toLowerCase()) || values.size >= 2) {
				// Create a rule for each unique value
				for (const value of values) {
					const folderName = value.charAt(0).toUpperCase() + value.slice(1);
					newRules.push({
						id: generateUUID(),
						name: `${propName}: ${value}`,
						enabled: true,
						destinationFolder: `${propName.charAt(0).toUpperCase() + propName.slice(1)}/${folderName}`,
						createSubfolders: false,
						propertyName: propName,
						propertyValue: value,
						matchType: 'equals' as const,
						caseSensitive: false,
						useTags: false
					});
				}
			}
		}

		// Generate rules for popular tags (tags used more than once)
		const tagCounts = new Map<string, number>();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.tags) {
				cache.tags.forEach(tag => {
					const cleanTag = tag.tag.replace(/^#/, '');
					tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
				});
			}
		}

		for (const [tag, count] of tagCounts) {
			if (count >= 2) { // Only create rules for tags used multiple times
				const folderName = tag.split('/').pop()!; // Get last part of nested tag
				const capitalizedFolder = folderName.charAt(0).toUpperCase() + folderName.slice(1);
				newRules.push({
					id: generateUUID(),
					name: `Tag: ${tag}`,
					enabled: true,
					destinationFolder: `Tags/${capitalizedFolder}`,
					createSubfolders: false,
					propertyName: 'tags',
					propertyValue: tag,
					matchType: 'equals' as const,
					caseSensitive: false,
					useTags: true,
					tagValue: tag
				});
			}
		}

		if (newRules.length === 0) {
			new Notice('No properties or tags found to generate rules from');
			return;
		}

		// Add new rules to settings
		this.settings.rules = newRules;
		await this.saveSettings();

		new Notice(`Generated ${newRules.length} rules! Check Settings → Smart File Sorter to review and adjust.`, 7000);
	}

	private isFileExcluded(file: TFile): boolean {
		if (this.settings.excludedFolders.length === 0) {
			return false;
		}

		const filePath = file.path;

		return this.settings.excludedFolders.some(excludedFolder => {
			return (
				filePath.startsWith(excludedFolder + '/') ||
				filePath === excludedFolder
			);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Update file sorter verbose logging
		if (this.fileSorter) {
			this.fileSorter.setVerboseLogging(this.settings.verboseLogging);
		}
	}
}
