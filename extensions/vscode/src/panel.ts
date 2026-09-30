import * as vscode from 'vscode';

export class PerfectAgentPanel {
  public static currentPanel: PerfectAgentPanel | undefined;
  public static readonly viewType = 'perfectAgent';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Beside;

    if (PerfectAgentPanel.currentPanel) {
      PerfectAgentPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PerfectAgentPanel.viewType,
      'PerfectAgent',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    PerfectAgentPanel.currentPanel = new PerfectAgentPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    PerfectAgentPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) disposable.dispose();
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PerfectAgent</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: var(--vscode-textLink-foreground); }
    textarea { width: 100%; height: 100px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; margin-top: 8px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .status { margin-top: 16px; padding: 8px; background: var(--vscode-editor-background); border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>PerfectAgent</h1>
    <p>Autonomous AI coding agent</p>
    <textarea id="task" placeholder="Describe a task..."></textarea>
    <br>
    <button onclick="sendTask()">Send Task</button>
    <div id="status" class="status">Ready</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function sendTask() {
      const task = document.getElementById('task').value;
      if (!task.trim()) return;

      document.getElementById('status').textContent = 'Sending...';
      vscode.postMessage({ type: 'sendTask', task });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'status') {
        document.getElementById('status').textContent = message.status;
      }
    });
  </script>
</body>
</html>`;
  }
}
