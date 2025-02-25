import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile
} from "obsidian";
import * as prettier from "prettier";
import pluginBabel from "prettier/parser-babel";

interface CodeFormatterSettings {
	languages: Record<string, boolean>;
	indentSize: number;
	indentWithTabs: boolean;
	printWidth: number;
}

const DEFAULT_SETTINGS: CodeFormatterSettings = {
	languages: {
		javascript: true,
		typescript: true,
		json: true,
		html: true,
		css: true,
		markdown: true,
		yaml: true
	},
	indentSize: 2,
	indentWithTabs: false,
	printWidth: 80
};

export default class CodeFormatterPlugin extends Plugin {
	settings: CodeFormatterSettings;

	async onload() {
		await this.loadSettings();

		// Auto-format markdown files when they are modified.
		// this.registerEvent(
		// 	this.app.vault.on("modify", file => {
		// 		if (file instanceof TFile && file.extension === "md") {
		// 			this.formatCodeBlocksInFile(file.path);
		// 		}
		// 	})
		// );

		// Add a settings tab.
		this.addSettingTab(new CodeFormatterSettingTab(this.app, this));

		// Command to manually format code blocks in the active editor.
		this.addCommand({
			id: "format-code-blocks",
			name: "Format code blocks in current file",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view.file) {
					this.formatCodeBlocksInFile(view.file.path);
					new Notice("Code blocks formatted");
				}
			}
		});

		console.log("Code Formatter plugin loaded");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async formatCodeBlocksInFile(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		const formattedContent = await this.processMarkdown(content);

		if (content !== formattedContent) {
			await this.app.vault.modify(file, formattedContent);
			new Notice("Code blocks formatted");
		}
	}
	async processMarkdown(markdownText: string): Promise<string> {
		// Regex to match code blocks with language specifier
		const codeBlockRegex = /```([\w+-]+)\n([\s\S]*?)```/g;
		const matches = Array.from(markdownText.matchAll(codeBlockRegex));
		let result = markdownText;

		for (const match of matches) {
			const [fullMatch, language, code] = match;
			// Check if the language is enabled in settings
			// if (!this.settings.languages[language.toLowerCase()]) {
			// 	continue;
			// }

			// Format the code based on the language
			const formattedCode = await this.formatCode(code, language);

			// Replace the code block
			result = result.replace(
				fullMatch,
				`\`\`\`${language}\n${formattedCode}\n\`\`\``
			);
		}
		console.log("Processed markdown:", result);
		return result;
	}

	getLanguageGroup(language: string): string {
		// Map aliases to their primary language group.
		const languageGroups: Record<string, string> = {
			js: "javascript",
			jsx: "javascript",
			ts: "typescript",
			tsx: "typescript",
			yml: "yaml",
			md: "markdown"
		};
		return languageGroups[language] || language;
	}

	async formatCode(code: string, language: string) {
		const parser = this.getParserForLanguage(language);
		if (!parser) {
			console.log(`No parser available for language: ${language}`);
			return code;
		}

		try {
			const formatted = await prettier.format(code, {
				parser: parser,
				// filepath: filePath,
				plugins: [pluginBabel],
				// 	// "prettier-plugin-packagejson",
				// 	{parsers:parserBabel.parsers}
				// 	// parserHtml,
				// 	// parserMarkdown,
				// 	// parserPostcss,
				// 	// parserTypescript,
				// 	// parserYaml
				// ],
				tabWidth: this.settings.indentSize,
				useTabs: this.settings.indentWithTabs,
				printWidth: this.settings.printWidth
			});
			// Remove any trailing newline that Prettier might add.
			return formatted.trim();
		} catch (error) {
			console.error("Error formatting with Prettier:", error);
			return code; //this.applyBasicFormatting(code);
		}
	}

	getParserForLanguage(language: string): string | null {
		// Map language to the corresponding Prettier parser.
		const parserMap: Record<string, string> = {
			javascript: "babel",
			js: "babel",
			jsx: "babel",
			typescript: "typescript",
			ts: "typescript",
			tsx: "typescript",
			json: "json",
			html: "html",
			xml: "html",
			svg: "html",
			css: "css",
			scss: "scss",
			less: "less",
			markdown: "markdown",
			md: "markdown",
			yaml: "yaml",
			yml: "yaml",
			python: "python"
		};
		return parserMap[language] || null;
	}

	// applyBasicFormatting(code: string): string {
	// 	// Basic fallback formatting: normalize indentation.
	// 	const lines = code.split("\n");
	// 	const formattedLines: string[] = [];
	// 	let indentLevel = 0;
	// 	const indentChar = this.settings.indentWithTabs
	// 		? "\t"
	// 		: " ".repeat(this.settings.indentSize);

	// 	for (const line of lines) {
	// 		const trimmedLine = line.trim();
	// 		if (trimmedLine.length === 0) {
	// 			formattedLines.push("");
	// 			continue;
	// 		}
	// 		// Heuristic for decreasing indent.
	// 		if (/^[}\])]/.test(trimmedLine) && indentLevel > 0) {
	// 			indentLevel--;
	// 		}
	// 		const indent = indentChar.repeat(indentLevel);
	// 		formattedLines.push(indent + trimmedLine);
	// 		// Heuristic for increasing indent.
	// 		if (/[{\[(]$/.test(trimmedLine)) {
	// 			indentLevel++;
	// 		}
	// 	}
	// 	return formattedLines.join("\n");
	// }

	onunload() {
		console.log("Code Formatter plugin unloaded");
	}
}

class CodeFormatterSettingTab extends PluginSettingTab {
	plugin: CodeFormatterPlugin;

	constructor(app: App, plugin: CodeFormatterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Code Formatter Settings" });

		new Setting(containerEl)
			.setName("Indent size")
			.setDesc("Number of spaces or tab size to use for indentation")
			.addSlider(slider =>
				slider
					.setLimits(1, 8, 1)
					.setValue(this.plugin.settings.indentSize)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.indentSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Indent with tabs")
			.setDesc("Use tabs instead of spaces for indentation")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.indentWithTabs)
					.onChange(async value => {
						this.plugin.settings.indentWithTabs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Print width")
			.setDesc("Maximum line length before wrapping")
			.addSlider(slider =>
				slider
					.setLimits(40, 120, 1)
					.setValue(this.plugin.settings.printWidth)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.printWidth = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Languages" });
		containerEl.createEl("p", {
			text: "Enable or disable formatting for specific languages"
		});

		// Create a toggle for each language.
		for (const language in this.plugin.settings.languages) {
			new Setting(containerEl)
				.setName(language.charAt(0).toUpperCase() + language.slice(1))
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.languages[language])
						.onChange(async value => {
							this.plugin.settings.languages[language] = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
