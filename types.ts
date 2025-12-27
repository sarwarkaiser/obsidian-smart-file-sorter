export interface SortingRule {
	id: string;
	name: string;
	enabled: boolean;
	destinationFolder: string;
	createSubfolders: boolean;
	subfolderProperty?: string;

	// Matching conditions
	propertyName: string;
	propertyValue: string;
	matchType: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
	caseSensitive: boolean;

	// Tags support
	useTags: boolean;
	tagValue?: string;
}

export interface PluginSettings {
	rules: SortingRule[];
	enableAutoSort: boolean;
	sortOnModify: boolean;
	sortOnCreate: boolean;
	showNotifications: boolean;
	excludedFolders: string[];
	verboseLogging: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	rules: [
		{
			id: crypto.randomUUID(),
			name: 'Example: Soccer files',
			enabled: false,
			destinationFolder: 'Topics/Soccer',
			createSubfolders: false,
			propertyName: 'topic',
			propertyValue: 'soccer',
			matchType: 'equals',
			caseSensitive: false,
			useTags: false
		}
	],
	enableAutoSort: false,
	sortOnModify: true,
	sortOnCreate: true,
	showNotifications: true,
	excludedFolders: [],
	verboseLogging: false
};

export interface MoveOperation {
	file: string;
	from: string;
	to: string;
	rule: string;
	timestamp: number;
}
