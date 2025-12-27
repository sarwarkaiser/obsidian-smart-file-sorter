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
	}

	private registerEventHandlers(): void {
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

		// Handle file modification
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (
					this.settings.enableAutoSort &&
					this.settings.sortOnModify &&
					file instanceof TFile &&
					file.extension === 'md'
				) {
					// Delay to ensure metadata is updated
					setTimeout(() => this.autoSortFile(file), 500);
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
			new Notice(`Error sorting files: ${error.message}`);
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
			new Notice(`Error sorting folder: ${error.message}`);
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
