import { App, TFile, TFolder, normalizePath, Notice, CachedMetadata } from 'obsidian';
import { SortingRule } from './types';

export class FileSorter {
	private app: App;
	private verboseLogging: boolean;

	constructor(app: App, verboseLogging: boolean = false) {
		this.app = app;
		this.verboseLogging = verboseLogging;
	}

	setVerboseLogging(verbose: boolean): void {
		this.verboseLogging = verbose;
	}

	/**
	 * Check if a file matches a specific rule
	 */
	fileMatchesRule(file: TFile, rule: SortingRule): boolean {
		if (!rule.enabled) {
			return false;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) {
			return false;
		}

		// Check if using tags
		if (rule.useTags && rule.tagValue) {
			return this.matchesTags(file, cache, rule);
		}

		// Check property-based matching
		return this.matchesProperty(cache, rule);
	}

	/**
	 * Match based on tags
	 */
	private matchesTags(file: TFile, cache: CachedMetadata, rule: SortingRule): boolean {
		const fileTags = this.getAllTags(file, cache);

		if (fileTags.length === 0) {
			return false;
		}

		const tagToMatch = rule.tagValue!.toLowerCase().replace(/^#/, '');

		return fileTags.some(tag => {
			const cleanTag = tag.toLowerCase().replace(/^#/, '');

			switch (rule.matchType) {
				case 'equals':
					return rule.caseSensitive
						? tag.replace(/^#/, '') === rule.tagValue!.replace(/^#/, '')
						: cleanTag === tagToMatch;
				case 'contains':
					return cleanTag.includes(tagToMatch);
				case 'startsWith':
					return cleanTag.startsWith(tagToMatch);
				case 'endsWith':
					return cleanTag.endsWith(tagToMatch);
				case 'regex':
					try {
						const regex = new RegExp(rule.tagValue!, rule.caseSensitive ? '' : 'i');
						return regex.test(tag);
					} catch (e) {
						console.error('Invalid regex pattern:', rule.tagValue, e);
						return false;
					}
				default:
					return false;
			}
		});
	}

	/**
	 * Get all tags from a file (frontmatter and inline)
	 */
	private getAllTags(file: TFile, cache: CachedMetadata): string[] {
		const tags: string[] = [];

		// Get frontmatter tags
		if (cache.frontmatter?.tags) {
			const frontmatterTags = cache.frontmatter.tags;
			if (Array.isArray(frontmatterTags)) {
				tags.push(...frontmatterTags.map(t => String(t)));
			} else if (typeof frontmatterTags === 'string') {
				tags.push(...frontmatterTags.split(',').map(t => t.trim()));
			}
		}

		// Get inline tags
		if (cache.tags) {
			tags.push(...cache.tags.map(t => t.tag));
		}

		return [...new Set(tags)]; // Remove duplicates
	}

	/**
	 * Match based on property value
	 */
	private matchesProperty(cache: CachedMetadata, rule: SortingRule): boolean {
		if (!cache.frontmatter) {
			return false;
		}

		const propertyValue = cache.frontmatter[rule.propertyName];

		if (propertyValue === undefined || propertyValue === null) {
			return false;
		}

		const propValueStr = String(propertyValue);
		const ruleValueStr = String(rule.propertyValue);

		switch (rule.matchType) {
			case 'equals':
				return rule.caseSensitive
					? propValueStr === ruleValueStr
					: propValueStr.toLowerCase() === ruleValueStr.toLowerCase();

			case 'contains':
				return rule.caseSensitive
					? propValueStr.includes(ruleValueStr)
					: propValueStr.toLowerCase().includes(ruleValueStr.toLowerCase());

			case 'startsWith':
				return rule.caseSensitive
					? propValueStr.startsWith(ruleValueStr)
					: propValueStr.toLowerCase().startsWith(ruleValueStr.toLowerCase());

			case 'endsWith':
				return rule.caseSensitive
					? propValueStr.endsWith(ruleValueStr)
					: propValueStr.toLowerCase().endsWith(ruleValueStr.toLowerCase());

			case 'regex':
				try {
					const regex = new RegExp(ruleValueStr, rule.caseSensitive ? '' : 'i');
					return regex.test(propValueStr);
				} catch (e) {
					console.error('Invalid regex pattern:', ruleValueStr, e);
					return false;
				}

			default:
				return false;
		}
	}

	/**
	 * Find the first matching rule for a file
	 */
	findMatchingRule(file: TFile, rules: SortingRule[]): SortingRule | null {
		for (const rule of rules) {
			if (this.fileMatchesRule(file, rule)) {
				return rule;
			}
		}
		return null;
	}

	/**
	 * Move a file based on a rule
	 */
	async moveFileByRule(file: TFile, rule: SortingRule): Promise<boolean> {
		try {
			let destinationPath = rule.destinationFolder;

			// Handle subfolder creation
			if (rule.createSubfolders && rule.subfolderProperty) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter) {
					const subfolderValue = cache.frontmatter[rule.subfolderProperty];
					if (subfolderValue) {
						destinationPath = normalizePath(
							`${destinationPath}/${String(subfolderValue)}`
						);
					}
				}
			}

			// Normalize the destination folder path
			destinationPath = normalizePath(destinationPath);

			// Ensure destination folder exists
			await this.ensureFolderExists(destinationPath);

			// Calculate new file path
			const newPath = normalizePath(`${destinationPath}/${file.name}`);

			// Check if file is already in the correct location
			if (file.path === newPath) {
				if (this.verboseLogging) {
					console.log(`File already in correct location: ${file.path}`);
				}
				return false;
			}

			// Check if a file already exists at destination
			const existingFile = this.app.vault.getAbstractFileByPath(newPath);
			if (existingFile && existingFile !== file) {
				console.warn(`File already exists at destination: ${newPath}`);
				new Notice(`Cannot move ${file.name}: file already exists at destination`);
				return false;
			}

			// Move the file
			await this.app.fileManager.renameFile(file, newPath);

			if (this.verboseLogging) {
				console.log(`Moved ${file.path} to ${newPath}`);
			}

			return true;
		} catch (error) {
			console.error(`Error moving file ${file.path}:`, error);
			new Notice(`Error moving file ${file.name}: ${error.message}`);
			return false;
		}
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);

		// Root folder always exists
		if (normalizedPath === '' || normalizedPath === '/') {
			return;
		}

		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
			if (this.verboseLogging) {
				console.log(`Created folder: ${normalizedPath}`);
			}
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	/**
	 * Sort all files in the vault based on rules
	 */
	async sortAllFiles(
		rules: SortingRule[],
		excludedFolders: string[],
		onProgress?: (current: number, total: number) => void
	): Promise<{ moved: number; skipped: number; errors: number }> {
		const files = this.app.vault.getMarkdownFiles();
		const enabledRules = rules.filter(r => r.enabled);

		if (enabledRules.length === 0) {
			new Notice('No enabled sorting rules found');
			return { moved: 0, skipped: 0, errors: 0 };
		}

		let moved = 0;
		let skipped = 0;
		let errors = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			// Check if file is in excluded folder
			if (this.isFileInExcludedFolder(file, excludedFolders)) {
				skipped++;
				continue;
			}

			// Find matching rule
			const matchingRule = this.findMatchingRule(file, enabledRules);

			if (!matchingRule) {
				skipped++;
			} else {
				try {
					const wasMoved = await this.moveFileByRule(file, matchingRule);
					if (wasMoved) {
						moved++;
					} else {
						skipped++;
					}
				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errors++;
				}
			}

			if (onProgress) {
				onProgress(i + 1, files.length);
			}
		}

		return { moved, skipped, errors };
	}

	/**
	 * Check if a file is in an excluded folder
	 */
	private isFileInExcludedFolder(file: TFile, excludedFolders: string[]): boolean {
		if (excludedFolders.length === 0) {
			return false;
		}

		const filePath = file.path;

		return excludedFolders.some(excludedFolder => {
			const normalizedExcluded = normalizePath(excludedFolder);
			return filePath.startsWith(normalizedExcluded + '/') ||
			       filePath === normalizedExcluded;
		});
	}

	/**
	 * Sort files in a specific folder
	 */
	async sortFolder(
		folder: TFolder,
		rules: SortingRule[],
		recursive: boolean = false
	): Promise<{ moved: number; skipped: number; errors: number }> {
		const enabledRules = rules.filter(r => r.enabled);
		let moved = 0;
		let skipped = 0;
		let errors = 0;

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				const matchingRule = this.findMatchingRule(child, enabledRules);

				if (!matchingRule) {
					skipped++;
				} else {
					try {
						const wasMoved = await this.moveFileByRule(child, matchingRule);
						if (wasMoved) {
							moved++;
						} else {
							skipped++;
						}
					} catch (error) {
						console.error(`Error processing ${child.path}:`, error);
						errors++;
					}
				}
			} else if (recursive && child instanceof TFolder) {
				const result = await this.sortFolder(child, rules, recursive);
				moved += result.moved;
				skipped += result.skipped;
				errors += result.errors;
			}
		}

		return { moved, skipped, errors };
	}
}
