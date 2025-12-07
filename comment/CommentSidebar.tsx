import React, { useState, useEffect, useCallback, useMemo } from "react";
import { HostAPI, Disposable } from "../../src-frontend/engine/types";
import { CommentDataService, CommentThread, Comment } from "./CommentData";
import { EditorState } from "@tiptap/pm/state";
import { Mark } from "@tiptap/pm/model";

interface CommentSidebarProps {
    hostApi: HostAPI;
    commentDataService: CommentDataService;
    getEditorState: () => EditorState | null;
}

// Helper to find unique comment thread IDs in the current selection range
const findThreadIdsInSelection = (state: EditorState | null): string[] => {
    if (!state) return [];
    
    const { selection } = state;
    const threadIds = new Set<string>();

    // Check all nodes between the start and end of the selection
    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
        if (node.isInline && node.marks) {
            node.marks.forEach((mark: Mark) => {
                // Check for our custom mark and ensure it has a thread ID
                if (mark.type.name === 'commentThread' && mark.attrs.threadId) {
                    threadIds.add(mark.attrs.threadId as string);
                }
            });
        }
    });

    return Array.from(threadIds);
};

// Component to render a single comment (a reply)
const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #333' }}>
        <strong style={{ fontSize: '0.9em' }}>{comment.userName}</strong> 
        <small style={{ float: 'right', color: '#888', fontSize: '0.75em' }}>
            {new Date(comment.timestamp).toLocaleDateString()} {new Date(comment.timestamp).toLocaleTimeString()}
        </small>
        <p style={{ margin: '5px 0', whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>{comment.content}</p>
    </div>
);

// Component to render a full thread
const CommentThreadComponent: React.FC<{ 
    thread: CommentThread, 
    commentDataService: CommentDataService,
    onEditorAction: () => void;
    onNavigate: (threadId: string) => void;
    isHighlighted?: boolean;
}> = ({ thread, commentDataService, onEditorAction, onNavigate, isHighlighted }) => {
    const [replyText, setReplyText] = useState('');
    const [showReply, setShowReply] = useState(false);

    const handleReply = () => {
        if (replyText.trim()) {
            commentDataService.addReply(thread.id, replyText);
            setReplyText('');
            setShowReply(false);
            onEditorAction(); // Force UI update
        }
    };

    const handleToggleResolve = () => {
        commentDataService.toggleResolve(thread.id, !thread.resolved);
        onEditorAction();
    };

    const handleDelete = () => {
        if (window.confirm("Delete this comment thread and remove the highlight from the document?")) {
            commentDataService.deleteThread(thread.id);
            onEditorAction();
        }
    }

    return (
        <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            border: isHighlighted ? '1px solid var(--accent)' : (thread.resolved ? '1px dashed #555' : '1px solid #cdd6f4'),
            borderRadius: '5px',
            background: thread.resolved ? '#1e1e2e' : '#242438',
            transition: 'border 0.2s ease-in-out',
            boxShadow: isHighlighted ? '0 0 5px rgba(137, 180, 250, 0.2)' : 'none'
        }}>
            <h4 
                onClick={() => onNavigate(thread.id)}
                style={{ 
                    margin: '0 0 10px 0', 
                    color: thread.resolved ? '#888' : (isHighlighted ? 'var(--accent)' : '#cdd6f4'), 
                    fontSize: '1em',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
                title="Click to jump to comment in document"
            >
                <span>Thread ({thread.comments.length} replies)</span>
                {thread.resolved && <span style={{ marginLeft: '10px', color: 'lime', fontSize: '0.8em' }}>[RESOLVED]</span>}
            </h4>
            
            {thread.comments.map(comment => <CommentItem key={comment.id} comment={comment} />)}

            <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                <button 
                    onClick={handleToggleResolve}
                    style={{ background: 'transparent', color: '#cdd6f4', border: '1px solid #cdd6f4', padding: '5px 8px', fontSize: '0.8em', cursor: 'pointer' }}
                >
                    {thread.resolved ? 'Re-open' : 'Resolve'}
                </button>
                <button 
                    onClick={() => setShowReply(!showReply)}
                    disabled={thread.resolved}
                    style={{ background: 'transparent', color: '#cdd6f4', border: '1px solid #cdd6f4', padding: '5px 8px', fontSize: '0.8em', cursor: thread.resolved ? 'not-allowed' : 'pointer' }}
                >
                    {showReply ? 'Cancel' : 'Reply'}
                </button>
                <button 
                    onClick={handleDelete}
                    style={{ background: 'transparent', color: 'red', border: '1px solid red', padding: '5px 8px', fontSize: '0.8em', marginLeft: 'auto', cursor: 'pointer' }}
                >
                    Delete
                </button>
            </div>
            
            {showReply && !thread.resolved && (
                <div style={{ marginTop: '10px' }}>
                    <textarea 
                        value={replyText} 
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Add a reply..."
                        rows={2}
                        style={{ width: '100%', padding: '5px', background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #333', resize: 'none' }}
                    />
                    <button onClick={handleReply} style={{ padding: '5px 10px', width: '100%', background: '#cdd6f4', color: '#1e1e2e', border: 'none', cursor: 'pointer' }}>
                        Post Reply
                    </button>
                </div>
            )}
        </div>
    );
};


export const CommentSidebar: React.FC<CommentSidebarProps> = ({ 
    hostApi, 
    commentDataService, 
    getEditorState 
}) => {
    // A key to force a re-render when collaborative data changes
    const [updateKey, setUpdateKey] = useState(0);
    // Threads on the currently selected text
    const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
    
    const forceUpdate = useCallback(() => setUpdateKey(k => k + 1), []);

    // 1. Listen for Yjs changes to ensure the UI updates globally
    useEffect(() => {
        const yMap = hostApi.data.getMap('comment-threads');
        const observer = () => {
            forceUpdate();
            // Re-check selection after Yjs update in case a thread was deleted/resolved
            const editorState = getEditorState();
            setSelectedThreadIds(findThreadIdsInSelection(editorState));
        };
        yMap.observeDeep(observer);
        return () => yMap.unobserveDeep(observer);
    }, [hostApi, forceUpdate, getEditorState]);

    // 2. Listen for Editor Selection changes (via custom Tiptap extension event)
    useEffect(() => {
        const onSelectionChange = () => {
            const editorState = getEditorState();
            setSelectedThreadIds(findThreadIdsInSelection(editorState));
        };
        
        // FIX: Match the event name emitted by index.tsx
        const disposable: Disposable = hostApi.events.on('comment.selection-changed', onSelectionChange);
        return () => disposable.dispose();
    }, [hostApi, getEditorState]);

    // Fetch and categorize threads
    const allThreads = useMemo(() => {
        return commentDataService.getAllThreads();
    }, [commentDataService, updateKey]);
    
    const selectedThreads = useMemo(() => {
        return allThreads
            .filter(thread => selectedThreadIds.includes(thread.id))
            .sort((a, b) => a.range.from - b.range.from);
    }, [allThreads, selectedThreadIds]);

    const allUnresolvedThreads = useMemo(() => {
        // Exclude threads that are currently selected AND resolved ones
        return allThreads
            .filter(thread => !thread.resolved && !selectedThreadIds.includes(thread.id))
            .sort((a, b) => a.range.from - b.range.from);
    }, [allThreads, selectedThreadIds]);


    const handleNavigate = (threadId: string) => {
        const editor = hostApi.editor.getSafeInstance();
        if (!editor) return;

        let foundPos: number | null = null;
        
        // Scan the document for the mark associated with this thread
        editor.state.doc.descendants((node, pos) => {
            if (foundPos !== null) return false; // Stop if found
            if (node.isInline && node.marks) {
                const mark = node.marks.find(m => m.type.name === 'commentThread' && m.attrs.threadId === threadId);
                if (mark) {
                    foundPos = pos;
                    return false;
                }
            }
            return true;
        });

        if (foundPos !== null) {
            editor.chain()
                .focus()
                .setTextSelection(foundPos)
                .scrollIntoView()
                .run();
        }
    };

    const renderThreads = (threads: CommentThread[], isHighlighted: boolean) => (
        threads.map(thread => (
            <CommentThreadComponent 
                key={thread.id} 
                thread={thread} 
                commentDataService={commentDataService} 
                onEditorAction={forceUpdate}
                onNavigate={handleNavigate}
                isHighlighted={isHighlighted}
            />
        ))
    );

    return (
        <div style={{ padding: '10px', color: '#cdd6f4', height: '100%', overflowY: 'auto' }}>
            {/* Simple style to make the commented text visible in the editor */}
            <style>{`
                .comment-thread-mark {
                    background-color: rgba(255, 255, 0, 0.3); /* Subtle yellow highlight */
                    padding: 0 1px;
                    border-radius: 2px;
                    cursor: pointer;
                }
            `}</style>

            {selectedThreads.length > 0 && (
                <>
                    <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', marginBottom: '15px', fontSize: '1.1em', color: 'var(--accent)' }}>
                        Comments on Selected Text ({selectedThreads.length})
                    </h3>
                    {renderThreads(selectedThreads, true)}
                    <div style={{ borderTop: '1px dashed #444', margin: '20px 0' }} />
                </>
            )}

            <h3 style={{ paddingBottom: '5px', marginBottom: '10px', fontSize: '1.1em' }}>
                All Unresolved Threads ({allUnresolvedThreads.length})
            </h3>
            
            {allUnresolvedThreads.length > 0 ? (
                renderThreads(allUnresolvedThreads, false)
            ) : (
                <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em' }}>
                    {selectedThreads.length === 0 ? "No active comment threads." : "No other unresolved comments."}
                </p>
            )}
        </div>
    );
};