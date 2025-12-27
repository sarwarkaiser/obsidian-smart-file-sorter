import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
import SmartFileSorterPlugin from './main';
import { SortingRule } from './types';

export class SmartFileSorterSettingTab extends PluginSettingTab {
	plugin: SmartFileSorterPlugin;

	constructor(app: App, plugin: SmartFileSorterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Smart File Sorter settings' });

		// General Settings Section
		this.addGeneralSettings(containerEl);

		// Sorting Rules Section
		this.addRulesSection(containerEl);

		// Excluded Folders Section
		this.addExcludedFoldersSection(containerEl);
	}

	private addGeneralSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'General settings' });

		new Setting(containerEl)
			.setName('Enable automatic sorting')
			.setDesc('Automatically sort files when they are created or modified')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableAutoSort)
					.onChange(async value => {
						this.plugin.settings.enableAutoSort = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Sort on file creation')
			.setDesc('Automatically sort files when they are created')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.sortOnCreate)
					.onChange(async value => {
						this.plugin.settings.sortOnCreate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Sort on file modification')
			.setDesc('Automatically sort files when their properties are modified')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.sortOnModify)
					.onChange(async value => {
						this.plugin.settings.sortOnModify = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Display notifications when files are moved')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showNotifications)
					.onChange(async value => {
						this.plugin.settings.showNotifications = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Verbose logging')
			.setDesc('Enable detailed console logging for debugging')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.verboseLogging)
					.onChange(async value => {
						this.plugin.settings.verboseLogging = value;
						this.plugin.fileSorter.setVerboseLogging(value);
						await this.plugin.saveSettings();
					})
			);
	}

	private addRulesSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Sorting rules' });

		const rulesDesc = containerEl.createEl('p', {
			cls: 'setting-item-description'
		});
		rulesDesc.setText(
			'Define rules to automatically organize files based on their properties or tags. Rules are evaluated in order from top to bottom.'
		);

		// Display existing rules
		if (this.plugin.settings.rules.length === 0) {
			containerEl.createEl('p', {
				text: 'No sorting rules configured. Click "Add new rule" to create one.',
				cls: 'setting-item-description'
			});
		} else {
			this.plugin.settings.rules.forEach((rule, index) => {
				this.displayRule(containerEl, rule, index);
			});
		}

		// Add new rule button
		new Setting(containerEl)
			.addButton(btn =>
				btn
					.setButtonText('Add new rule')
					.setCta()
					.onClick(() => {
						// Generate UUID (compatible with all environments)
						const generateUUID = (): string => {
							if (typeof crypto !== 'undefined' && crypto.randomUUID) {
								return crypto.randomUUID();
							}
							// Fallback UUID generator
							return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
								const r = (Math.random() * 16) | 0;
								const v = c === 'x' ? r : (r & 0x3) | 0x8;
								return v.toString(16);
							});
						};

						const newRule: SortingRule = {
							id: generateUUID(),
							name: 'New sorting rule',
							enabled: true,
							destinationFolder: '',
							createSubfolders: false,
							propertyName: 'topic',
							propertyValue: '',
							matchType: 'equals',
							caseSensitive: false,
							useTags: false
						};

						new RuleEditorModal(
							this.app,
							newRule,
							async (savedRule) => {
								this.plugin.settings.rules.push(savedRule);
								await this.plugin.saveSettings();
								this.display();
							},
							null
						).open();
					})
			);
	}

	private displayRule(
		containerEl: HTMLElement,
		rule: SortingRule,
		index: number
	): void {
		const ruleContainer = containerEl.createDiv({ cls: 'smart-file-sorter-rule' });

		const matchInfo = rule.useTags
			? `Tag: ${rule.tagValue || '(not set)'}`
			: `${rule.propertyName}: ${rule.propertyValue || '(not set)'}`;

		const ruleDesc = `${matchInfo} → ${rule.destinationFolder || '(not set)'}`;

		new Setting(ruleContainer)
			.setName(rule.name)
			.setDesc(ruleDesc)
			.addToggle(toggle =>
				toggle
					.setValue(rule.enabled)
					.setTooltip(rule.enabled ? 'Enabled' : 'Disabled')
					.onChange(async value => {
						rule.enabled = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton(btn =>
				btn
					.setIcon('up-chevron-glyph')
					.setTooltip('Move up')
					.onClick(async () => {
						if (index > 0) {
							const temp = this.plugin.settings.rules[index - 1];
							this.plugin.settings.rules[index - 1] = rule;
							this.plugin.settings.rules[index] = temp;
							await this.plugin.saveSettings();
							this.display();
						}
					})
			)
			.addButton(btn =>
				btn
					.setIcon('down-chevron-glyph')
					.setTooltip('Move down')
					.onClick(async () => {
						if (index < this.plugin.settings.rules.length - 1) {
							const temp = this.plugin.settings.rules[index + 1];
							this.plugin.settings.rules[index + 1] = rule;
							this.plugin.settings.rules[index] = temp;
							await this.plugin.saveSettings();
							this.display();
						}
					})
			)
			.addButton(btn =>
				btn
					.setIcon('pencil')
					.setTooltip('Edit')
					.onClick(() => {
						new RuleEditorModal(
							this.app,
							rule,
							async (savedRule) => {
								this.plugin.settings.rules[index] = savedRule;
								await this.plugin.saveSettings();
								this.display();
							},
							async () => {
								this.plugin.settings.rules.splice(index, 1);
								await this.plugin.saveSettings();
								this.display();
							}
						).open();
					})
			)
			.addButton(btn =>
				btn
					.setIcon('trash')
					.setTooltip('Delete')
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
						new Notice(`Deleted rule: ${rule.name}`);
					})
			);
	}

	private addExcludedFoldersSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Excluded folders' });

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('Files in these folders will not be automatically sorted (one per line)')
			.addTextArea(text => {
				text
					.setPlaceholder('Archive\nTemplates\n.trash')
					.setValue(this.plugin.settings.excludedFolders.join('\n'))
					.onChange(async value => {
						this.plugin.settings.excludedFolders = value
							.split('\n')
							.map(f => f.trim())
							.filter(f => f.length > 0);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 30;
			});
	}
}

class RuleEditorModal extends Modal {
	rule: SortingRule;
	onSave: (rule: SortingRule) => Promise<void>;
	onDelete: (() => Promise<void>) | null;
	tempRule: SortingRule;

	constructor(
		app: App,
		rule: SortingRule,
		onSave: (rule: SortingRule) => Promise<void>,
		onDelete: (() => Promise<void>) | null
	) {
		super(app);
		this.rule = rule;
		this.onSave = onSave;
		this.onDelete = onDelete;
		// Create a copy to edit
		this.tempRule = { ...rule };
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Edit sorting rule' });

		// Rule Name
		new Setting(contentEl)
			.setName('Rule name')
			.setDesc('A descriptive name for this rule')
			.addText(text =>
				text
					.setPlaceholder('My sorting rule')
					.setValue(this.tempRule.name)
					.onChange(value => {
						this.tempRule.name = value;
					})
			);

		// Match Type Selector
		new Setting(contentEl)
			.setName('Match by')
			.setDesc('Choose whether to match by property value or tag')
			.addDropdown(dropdown =>
				dropdown
					.addOption('property', 'Property value')
					.addOption('tag', 'Tag')
					.setValue(this.tempRule.useTags ? 'tag' : 'property')
					.onChange(value => {
						this.tempRule.useTags = value === 'tag';
						this.refreshMatchFields(contentEl);
					})
			);

		// Container for dynamic match fields
		const matchFieldsContainer = contentEl.createDiv({ cls: 'match-fields-container' });
		this.renderMatchFields(matchFieldsContainer);

		// Destination Settings
		contentEl.createEl('h3', { text: 'Destination settings' });

		new Setting(contentEl)
			.setName('Destination folder')
			.setDesc('Where matching files should be moved (e.g., Topics/Soccer)')
			.addText(text =>
				text
					.setPlaceholder('Topics/Soccer')
					.setValue(this.tempRule.destinationFolder)
					.onChange(value => {
						this.tempRule.destinationFolder = value;
					})
			);

		new Setting(contentEl)
			.setName('Create subfolders')
			.setDesc('Organize files into subfolders based on a property value')
			.addToggle(toggle =>
				toggle
					.setValue(this.tempRule.createSubfolders)
					.onChange(value => {
						this.tempRule.createSubfolders = value;
						this.refreshSubfolderField(contentEl);
					})
			);

		// Subfolder property field (conditional)
		const subfolderContainer = contentEl.createDiv({ cls: 'subfolder-container' });
		this.renderSubfolderField(subfolderContainer);

		// Action Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.marginTop = '20px';
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.justifyContent = 'flex-end';

		new Setting(buttonContainer)
			.addButton(btn =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(async () => {
						// Validation
						if (!this.tempRule.name.trim()) {
							new Notice('Please enter a rule name');
							return;
						}
						if (!this.tempRule.destinationFolder.trim()) {
							new Notice('Please enter a destination folder');
							return;
						}
						if (this.tempRule.useTags && !this.tempRule.tagValue?.trim()) {
							new Notice('Please enter a tag value');
							return;
						}
						if (!this.tempRule.useTags && !this.tempRule.propertyValue.trim()) {
							new Notice('Please enter a property value');
							return;
						}

						await this.onSave(this.tempRule);
						this.close();
						new Notice(`Saved rule: ${this.tempRule.name}`);
					})
			)
			.addButton(btn =>
				btn
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					})
			);
	}

	private renderMatchFields(container: HTMLElement): void {
		container.empty();

		if (this.tempRule.useTags) {
			// Tag matching fields
			new Setting(container)
				.setName('Tag')
				.setDesc('The tag to match (with or without #)')
				.addText(text =>
					text
						.setPlaceholder('soccer or #soccer')
						.setValue(this.tempRule.tagValue || '')
						.onChange(value => {
							this.tempRule.tagValue = value;
						})
				);
		} else {
			// Property matching fields
			new Setting(container)
				.setName('Property name')
				.setDesc('The property to check (e.g., topic, category, status)')
				.addText(text =>
					text
						.setPlaceholder('topic')
						.setValue(this.tempRule.propertyName)
						.onChange(value => {
							this.tempRule.propertyName = value;
						})
				);

			new Setting(container)
				.setName('Property value')
				.setDesc('The value to match against')
				.addText(text =>
					text
						.setPlaceholder('soccer')
						.setValue(this.tempRule.propertyValue)
						.onChange(value => {
							this.tempRule.propertyValue = value;
						})
				);
		}

		// Match type (common for both)
		new Setting(container)
			.setName('Match type')
			.setDesc('How to compare the value')
			.addDropdown(dropdown =>
				dropdown
					.addOption('equals', 'Equals')
					.addOption('contains', 'Contains')
					.addOption('startsWith', 'Starts with')
					.addOption('endsWith', 'Ends with')
					.addOption('regex', 'Regular expression')
					.setValue(this.tempRule.matchType)
					.onChange(value => {
						this.tempRule.matchType = value as any;
					})
			);

		new Setting(container)
			.setName('Case sensitive')
			.setDesc('Match is case sensitive')
			.addToggle(toggle =>
				toggle
					.setValue(this.tempRule.caseSensitive)
					.onChange(value => {
						this.tempRule.caseSensitive = value;
					})
			);
	}

	private renderSubfolderField(container: HTMLElement): void {
		container.empty();

		if (this.tempRule.createSubfolders) {
			new Setting(container)
				.setName('Subfolder property')
				.setDesc('Create subfolders based on this property value')
				.addText(text =>
					text
						.setPlaceholder('category')
						.setValue(this.tempRule.subfolderProperty || '')
						.onChange(value => {
							this.tempRule.subfolderProperty = value;
						})
				);
		}
	}

	private refreshMatchFields(contentEl: HTMLElement): void {
		const container = contentEl.querySelector('.match-fields-container') as HTMLElement;
		if (container) {
			this.renderMatchFields(container);
		}
	}

	private refreshSubfolderField(contentEl: HTMLElement): void {
		const container = contentEl.querySelector('.subfolder-container') as HTMLElement;
		if (container) {
			this.renderSubfolderField(container);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
