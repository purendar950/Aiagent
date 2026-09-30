import * as vscode from 'vscode';
import { PerfectAgentPanel } from './panel';

export function activate(context: vscode.ExtensionContext) {
  console.log('PerfectAgent extension activated');

  const startCommand = vscode.commands.registerCommand('perfect-agent.start', () => {
    PerfectAgentPanel.createOrShow(context.extensionUri);
  });

  const stopCommand = vscode.commands.registerCommand('perfect-agent.stop', () => {
    PerfectAgentPanel.currentPanel?.dispose();
  });

  const openPanelCommand = vscode.commands.registerCommand('perfect-agent.openPanel', () => {
    PerfectAgentPanel.createOrShow(context.extensionUri);
  });

  const treeProvider = new PerfectAgentTreeProvider();
  vscode.window.registerTreeDataProvider('perfect-agent.tree', treeProvider);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(robot) PerfectAgent';
  statusBarItem.tooltip = 'Click to open PerfectAgent';
  statusBarItem.command = 'perfect-agent.openPanel';
  statusBarItem.show();

  context.subscriptions.push(startCommand, stopCommand, openPanelCommand, statusBarItem);
}

export function deactivate() {
  console.log('PerfectAgent extension deactivated');
}

class PerfectAgentTreeProvider implements vscode.TreeDataProvider<TaskItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

  getTreeItem(element: TaskItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TaskItem): Thenable<TaskItem[]> {
    if (!element) {
      return Promise.resolve([
        new TaskItem('No active tasks', '', vscode.TreeItemCollapsibleState.None),
      ]);
    }
    return Promise.resolve([]);
  }
}

class TaskItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}
