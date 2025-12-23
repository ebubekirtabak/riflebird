import { CommandContext, COMMON_EXCLUDE_DIRS, FileNode, getFileTree } from '@riflebird/core';
import { ProjectContext, FrameworkInfo, TestFrameworks } from '@models/project-context';
import { ConfigFile, TestFrameworksConfig } from '@models/project-config-files';
import {
  debug,
  error as errorLog,
  ProjectFileWalker,
  FileTreeWalker,
  FileTreeWalkerContext,
  detectTestOutputStrategy,
  detectPackageManagerInfo,
} from '@utils';
import { ProjectCacheManager } from '../cache';

export class ProjectContextProvider {
  private context: CommandContext;
  private projectRoot: string;
  private projectFileWalker: ProjectFileWalker;
  private fileTreeWalkerContext!: FileTreeWalkerContext;
  private fileTreeWalker!: FileTreeWalker;
  private fileTree!: FileNode[];
  private initialized = false;
  private cacheManager: ProjectCacheManager;

  constructor(context: CommandContext, projectRoot: string) {
    this.context = context;
    this.projectRoot = projectRoot;
    this.projectFileWalker = new ProjectFileWalker({ projectRoot });
    this.cacheManager = new ProjectCacheManager(projectRoot);
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.fileTree = await this.getFileTree();

    this.fileTreeWalkerContext = {
      projectRoot: this.projectRoot,
      fileTree: this.fileTree,
      aiClient: this.context.aiClient,
      config: this.context.config,
    };

    this.fileTreeWalker = new FileTreeWalker(this.fileTreeWalkerContext);
    this.initialized = true;
  }

  async getFileTree(): Promise<FileNode[]> {
    if (this.initialized) {
      return this.fileTree;
    }

    return await getFileTree(this.projectRoot, {
      excludeDirs: [...COMMON_EXCLUDE_DIRS],
      maxDepth: 5,
    });
  }

  async getFileTreeWalker(): Promise<FileTreeWalker> {
    if (this.initialized) {
      return this.fileTreeWalker;
    }

    await this.init();
    return this.fileTreeWalker;
  }

  async getContext(): Promise<ProjectContext> {
    await this.init();

    try {
      const cachedContext = await this.cacheManager.load();
      if (cachedContext) {
        debug('Using cached project context');
        return cachedContext;
      }

      const configFiles = await this.fileTreeWalker.findConfigFiles();
      debug(`Found ${configFiles} config files`);
      const { testFrameworks, languageConfig, linting, formatting } = configFiles;
      const testFrameworksContext = await this.readTestFramework(testFrameworks, this.projectRoot);

      // Detect unit test output strategy from config
      const testOutputDir = this.context.config.unitTesting?.testOutputDir;
      const unitTestOutputStrategy = testOutputDir
        ? detectTestOutputStrategy(testOutputDir)
        : undefined;

      const packageManagerInfo = await detectPackageManagerInfo(
        this.projectRoot,
        configFiles.packageManager
      );

      const context: ProjectContext = {
        configFiles,
        testFrameworks: testFrameworksContext,
        packageManager: {
          type: packageManagerInfo.type,
          testCommand: packageManagerInfo.testCommand,
          testScript: packageManagerInfo.testScript,
          packageInfo: packageManagerInfo.packageInfo,
          packageFilePath: packageManagerInfo.packageFilePath,
        },
        languageConfig: await this.readConfigFile(languageConfig),
        linterConfig: await this.readConfigFile(linting),
        formatterConfig: await this.readConfigFile(formatting),
        projectRoot: this.projectRoot,
        unitTestOutputStrategy,
      };

      await this.cacheManager.save(context);

      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorLog('ProjectContextProvider error:', message);
      throw error;
    }
  }

  async readTestFramework(
    { unit }: TestFrameworksConfig,
    projectRoot: string
  ): Promise<TestFrameworks> {
    try {
      let unitFramework: FrameworkInfo | null = null;
      const projectFileWalker = new ProjectFileWalker({ projectRoot });
      const { config } = this.context;
      const requestedUnitTest = config.unitTesting?.enabled && unit && unit.configFilePath;
      if (requestedUnitTest) {
        console.log(`Unit test framework detected: ${unit.name} at ${unit.configFilePath}`);
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
