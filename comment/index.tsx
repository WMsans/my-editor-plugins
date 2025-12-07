import React from "react";
import { HostAPI, PluginExports, BubbleItemOptions, Disposable } from "../../src-frontend/engine/types";
import { Mark, mergeAttributes, Extension } from "@tiptap/core";
import { CommentDataService, COMMENT_MAP_KEY } from "./CommentData";
import { CommentSidebar } from "./CommentSidebar.tsx";
import { EditorState } from "@tiptap/pm/state";

let commentDataService: CommentDataService;
let hostApi: HostAPI;

// --- Tiptap Mark Definition ---
const CommentMark = Mark.create({
  name: 'commentThread',
  
  // Mark attributes: stores the unique ID of the comment thread
  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-thread-id'),
        renderHTML: (attributes) => {
          if (!attributes.threadId) return {};
          return { 'data-thread-id': attributes.threadId };
        },
      },
    }
  },

  // How the mark is rendered in the DOM
  renderHTML({ mark, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'class': 'comment-thread-mark', // CSS class for highlighting
        'data-thread-id': mark.attrs.threadId,
      }),
      0,
    ]
  },

  // How the mark is parsed from HTML
  parseHTML() {
    return [ { tag: 'span[data-thread-id]' } ];
  },
});

// --- Tiptap Extension for Sidebar Updates ---
const SidebarUpdateExtension = Extension.create({
    name: 'sidebarUpdateExtension',
    onSelectionUpdate() {
        // When selection changes, emit an event so the sidebar can re-check the cursor position
        hostApi.events.emit('comment.selection-changed', {});
    },
});


// --- Command Handler ---
const addCommentCommand = (api: HostAPI) => async (commentText: string | undefined = undefined) => {
    const editor = api.editor.getSafeInstance();
    if (!editor) return;

    if (!editor.state.selection.empty) {
        const { from, to } = editor.state.selection;

        // Use the HostAPI's built-in message box to get the initial comment
        const initialComment = commentText || await api.window.showInputBox({
            prompt: "Enter your initial comment:"
        });
        
        if (initialComment) {
            // 1. Create a new collaborative comment thread
            const threadId = commentDataService.addThread({ from, to }, initialComment);

            // 2. Apply the 'commentThread' Mark to the selected text
            editor.chain().focus().setMark('commentThread', { threadId }).run();
            
            // 3. Notify the UI to focus the comments view
            api.events.emit('comment.focus-view');
        }
    } else {
        api.window.showInformationMessage("Please select some text to add a comment.");
    }
};

// --- Plugin Activation ---
export const activate: PluginExports['activate'] = async (api) => {
    hostApi = api;
    
    // 1. Initialize data service with a DYNAMIC getter for the collaborative map
    // This ensures we always get the map for the CURRENTLY active document
    commentDataService = new CommentDataService(() => api.data.getMap(COMMENT_MAP_KEY));

    // 2. Register Tiptap Extensions
    api.editor.registerExtension(CommentMark);
    api.editor.registerExtension(SidebarUpdateExtension);

    // 3. Register the command
    api.commands.registerCommand('comment.addComment', addCommentCommand(api));
    
    // 4. Register the Bubble Menu Item
    const bubbleItem: BubbleItemOptions = {
        id: 'addComment',
        icon: '💬', // Use the comment emoji for the button
        command: 'comment.addComment',
        tooltip: 'Add Comment (Alt+C)',
        pluginId: 'comment',
    };
    api.editor.registerBubbleItem(bubbleItem);
    
    // 5. Register the Sidebar Tab
    api.ui.registerSidebarTab({
        id: 'comment.commentView',
        icon: '💬',
        label: 'Comments',
        component: () => <CommentSidebar 
            hostApi={api} 
            commentDataService={commentDataService}
            getEditorState={() => api.editor.getState()} 
        />
    });
};

export const deactivate: PluginExports['deactivate'] = () => {
    // Cleanup logic would go here
};