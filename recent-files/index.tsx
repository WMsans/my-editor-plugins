import { HostAPI } from "../../src-frontend/mod-engine/types";

export function activate(api: HostAPI) {
    const VIEW_ID = "recent-files-view";
    let recentFiles: string[] = [];
    
    // Sort Mode: 'none' (insertion/manual), 'mru' (most recent), 'alpha' (A-Z)
    let sortMode: 'none' | 'mru' | 'alpha' = 'mru'; 

    // 1. Register Webview
    api.window.registerWebviewView(VIEW_ID, {
        entryPoint: "webview.html"
    });

    // 2. Helper to broadcast state to webview
    const broadcastState = () => {
        api.events.emit("recent-files:update", {
            files: getSortedFiles(),
            sortMode
        });
    };

    const getSortedFiles = () => {
        const files = [...recentFiles]; // Copy
        if (sortMode === 'alpha') {
            return files.sort((a, b) => {
                const nameA = a.split('/').pop() || a;
                const nameB = b.split('/').pop() || b;
                return nameA.localeCompare(nameB);
            });
        }
        // For 'mru' and 'none', we return the list as stored.
        // 'mru': The logic in 'file:open' keeps the newest at index 0.
        // 'none': The logic in 'file:open' appends to end, or 'updateOrder' sets specific order.
        return files; 
    };

    // 3. Listen for File Opens
    api.events.on('file:open', (data: any) => {
        const path = data.path;
        if (!path) return;

        // Remove existing if present
        const existingIndex = recentFiles.indexOf(path);
        
        if (sortMode === 'mru') {
             if (existingIndex !== -1) recentFiles.splice(existingIndex, 1);
             recentFiles.unshift(path); // Add to top
        } else if (sortMode === 'none') {
             // If manual/none, we only append if it's brand new. 
             // We do NOT move it if it's already in the list, preserving user's manual order.
             if (existingIndex === -1) recentFiles.push(path);
        } else {
             // If Alpha, we technically don't care about order in storage, 
             // but keeping it unique is good.
             if (existingIndex !== -1) recentFiles.splice(existingIndex, 1);
             recentFiles.push(path);
        }

        broadcastState();
    });

    // 4. Handle Commands from Webview
    api.commands.registerCommand("recent-files.open", (path: string) => {
        api.commands.executeCommand("file.open", path);
    });

    api.commands.registerCommand("recent-files.remove", (path: string) => {
        recentFiles = recentFiles.filter(p => p !== path);
        broadcastState();
    });

    // New Command: Handle Reordering
    api.commands.registerCommand("recent-files.updateOrder", (newFiles: string[]) => {
        if (sortMode === 'none') {
            recentFiles = newFiles;
            // State is updated, no need to broadcast immediately as UI triggered it,
            // but we do so to ensure consistency.
            broadcastState(); 
        }
    });

    api.commands.registerCommand("recent-files.setSort", (mode: any) => {
        sortMode = mode;
        broadcastState();
    });
    
    api.commands.registerCommand("recent-files.refresh", () => {
        broadcastState();
    });

    // Wait for view to load
    setTimeout(broadcastState, 1000);
}

export function deactivate() {}