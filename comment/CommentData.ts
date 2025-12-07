import * as Y from "yjs";
import { HostAPI } from "../../src-frontend/engine/types";

export interface Comment {
    id: string;
    userId: string;
    userName: string;
    timestamp: number;
    content: string;
}

export interface CommentThread {
    id: string;
    range: { from: number; to: number }; // Used for sorting/context, but Tiptap Mark holds the true position
    comments: Comment[];
    resolved: boolean;
}

// Key for the Yjs Map that stores all comment threads
export const COMMENT_MAP_KEY = "comment-threads";

export class CommentDataService {
    private getMap: () => Y.Map<any>;

    constructor(getMap: () => Y.Map<any>) {
        this.getMap = getMap;
    }

    private get commentThreadsMap() {
        return this.getMap();
    }

    private getCurrentUser(): { id: string, name: string } {
        // Placeholder for user data (in a real app, this would come from an AuthService)
        return { 
            id: 'user-' + Math.floor(Math.random() * 1000), 
            name: 'Collaborator ' + Math.floor(Math.random() * 10) 
        };
    }

    public getThread(id: string): CommentThread | undefined {
        const data = this.commentThreadsMap.get(id);
        // Use toJSON() to convert Y.Map/Y.Array back to plain JS objects
        return data ? data.toJSON() as CommentThread : undefined;
    }

    public getAllThreads(): CommentThread[] {
        const threads: CommentThread[] = [];
        this.commentThreadsMap.forEach((yMap) => {
            // Converts the Y.Map/Y.Array nested structure into the desired CommentThread
            threads.push(yMap.toJSON() as CommentThread);
        });
        return threads;
    }

    public addThread(range: { from: number, to: number }, initialCommentText: string): string {
        const user = this.getCurrentUser();
        const threadId = 'thread-' + Date.now();
        
        const initialComment: Comment = {
            id: 'comment-' + Date.now(),
            userId: user.id,
            userName: user.name,
            timestamp: Date.now(),
            content: initialCommentText,
        };

        const newThreadMap = new Y.Map();
        newThreadMap.set('id', threadId);
        newThreadMap.set('range', new Y.Map(Object.entries(range)));
        newThreadMap.set('resolved', false);
        
        const commentsArray = new Y.Array();
        commentsArray.push([new Y.Map(Object.entries(initialComment))]);
        newThreadMap.set('comments', commentsArray);

        // All modifications must be wrapped in a transaction for Yjs
        this.commentThreadsMap.doc?.transact(() => {
            this.commentThreadsMap.set(threadId, newThreadMap);
        });

        return threadId;
    }

    public addReply(threadId: string, replyText: string): void {
        const threadMap = this.commentThreadsMap.get(threadId) as Y.Map<any>;
        if (!threadMap) return;

        const user = this.getCurrentUser();
        const newReply: Comment = {
            id: 'comment-' + Date.now() + Math.random(),
            userId: user.id,
            userName: user.name,
            timestamp: Date.now(),
            content: replyText,
        };
        
        const commentsArray = threadMap.get('comments') as Y.Array<Y.Map<any>>;
        
        this.commentThreadsMap.doc?.transact(() => {
            commentsArray.push([new Y.Map(Object.entries(newReply))]);
        });
    }

    public toggleResolve(threadId: string, resolved: boolean): void {
        const threadMap = this.commentThreadsMap.get(threadId) as Y.Map<any>;
        if (!threadMap) return;
        
        this.commentThreadsMap.doc?.transact(() => {
            threadMap.set('resolved', resolved);
        });
    }

    public deleteThread(threadId: string): void {
        this.commentThreadsMap.doc?.transact(() => {
            this.commentThreadsMap.delete(threadId);
        });
    }
}