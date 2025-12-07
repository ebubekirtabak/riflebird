import { CommandContext, COMMON_EXCLUDE_DIRS, FileNode, getFileTree } from "@riflebird/core";
import { ProjectContext, FrameworkInfo, TestFrameworks } from "@models/project-context";
import { ConfigFile, TestFrameworksConfig } from "@models/project-config-files";
import { debug, error as errorLog, ProjectFileWalker, FileTreeWalker, FileTreeWalkerContext } from "@utils";


export class ProjectContextProvider {

  private context: CommandContext;
  private projectRoot: string;
  private projectFileWalker: ProjectFileWalker;
  private fileTreeWalkerContext!: FileTreeWalkerContext;
  private fileTreeWalker!: FileTreeWalker;
  private fileTree!: FileNode[];
  private initialized = false;

  constructor(context: CommandContext, projectRoot: string) {
    this.context = context;
    this.projectRoot = projectRoot;
    this.projectFileWalker = new ProjectFileWalker({ projectRoot });
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.fileTree = await getFileTree(this.projectRoot, {
      excludeDirs: [...COMMON_EXCLUDE_DIRS],
      maxDepth: 5,
    });

    this.fileTreeWalkerContext = {
      projectRoot: this.projectRoot,
      fileTree: this.fileTree,
      aiClient: this.context.aiClient,
      config: this.context.config,
    };

    this.fileTreeWalker = new FileTreeWalker(this.fileTreeWalkerContext);
    this.initialized = true;
  }

  async getContext(): Promise<ProjectContext> {
    await this.init();

    try {
      const configFiles = await this.fileTreeWalker.findConfigFiles();
      debug(`Found ${configFiles} config files`);
      const { testFrameworks, languageConfig, linting, formatting } = configFiles;
      const testFrameworksContext = await this.readTestFramework(testFrameworks, this.projectRoot);

      return {
        configFiles,
        testFrameworks: testFrameworksContext,
        languageConfig: await this.readConfigFile(languageConfig),
        linterConfig: await this.readConfigFile(linting),
        formatterConfig: await this.readConfigFile(formatting),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorLog('ProjectContextProvider error:', message);
      throw error;
    }
  }

  async readTestFramework({ unit }: TestFrameworksConfig, projectRoot: string): Promise<TestFrameworks> {
    try {
      let unitFramework: FrameworkInfo | null = null;
      const projectFileWalker = new ProjectFileWalker({ projectRoot });
      const { config } = this.context;
      const requestedUnitTest = config.unitTesting?.enabled && unit && unit.configFilePath;
      if (requestedUnitTest) {
        console.log(`Unit test framework detected: ${unit}`);
        const content = await projectFileWalker.readFileFromProject(unit.configFilePath);
        unitFramework = {
          ...unit,
          configContent: content,
        };
      }

      return {
        ...(unitFramework && { unit: unitFramework }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorLog('readUnitTestFramework error:', message);
      return {};
    }

  }

  async readConfigFile(configFile: ConfigFile): Promise<FrameworkInfo> {
    try {
      const content = await this.projectFileWalker.readFileFromProject(configFile.configFilePath);

      return {
        ...configFile,
        configContent: content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorLog('readConfigFile error:', message);
      return {};
    }
  }

}
