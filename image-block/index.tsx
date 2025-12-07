import React, { useState, useEffect, useRef } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";

// --- 1. The Component (UI) ---
const ImageComponent = (props: any) => {
  const [src, setSrc] = useState(props.node.attrs.src);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const api = (window as any).CollabAPI;

  // Sync with remote changes
  useEffect(() => {
    if (props.node.attrs.src !== src) {
      setSrc(props.node.attrs.src);
    }
  }, [props.node.attrs.src]);

  // Load Image Data
  useEffect(() => {
    let active = true;
    if (!src) {
        setImageUrl(null);
        return;
    }

    const loadImage = async (retries = 10) => {
        if(!api) return;
        setLoading(true);
        setError(null);
        try {
            const bytes: number[] = await api.data.fs.readFile(src);
            if (!active) return;
            
            const u8 = new Uint8Array(bytes);
            const blob = new Blob([u8]);
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
            setLoading(false);
        } catch (e: any) {
            if (!active) return;

            const isFileNotFound = e.toString().includes("os error 2") || 
                                   e.toString().includes("no such file") ||
                                   e.toString().includes("No such file");

            if (isFileNotFound && retries > 0) {
                console.log(`Image not found yet (${src}), retrying... attempts left: ${retries}`);
                setTimeout(() => loadImage(retries - 1), 1000);
            } else {
                setError("Failed to load image: " + e.toString());
                setLoading(false);
            }
        }
    };

    loadImage();
    
    return () => { 
        active = false;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [src]); 

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !api) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        return;
    }

    setLoading(true);
    try {
        const buffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));

        try {
            await api.data.fs.createDirectory("resources");
            await api.data.fs.createDirectory("resources/textures");
        } catch (err) {
            console.log("Folder creation result:", err);
        }

        const relPath = `resources/textures/${file.name}`;
        await api.data.fs.writeFile(relPath, data);

        props.updateAttributes({ src: relPath });
        setSrc(relPath); 
    } catch (e: any) {
        setError("Upload failed: " + e.toString());
    } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <NodeViewWrapper className="image-block" style={{ margin: '1rem 0' }}>
      <div className="image-content" contentEditable={false} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100px',
          position: 'relative'
      }}>
        {loading && <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>Loading...</div>}
        
        {imageUrl ? (
             <img 
                src={imageUrl} 
                alt="content" 
                style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '4px' }}
             />
        ) : (
            !loading && <div style={{ color: 'var(--text-muted)', padding: '20px' }}>No image selected</div>
        )}

        {error && <div style={{ color: '#f38ba8', fontSize: '0.8rem', marginTop: '10px' }}>{error}</div>}

        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {src || "Unsaved"}
            </span>
            <button 
                onClick={handleUploadClick}
                style={{
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', 
                    padding: '4px 8px', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '0.85rem'
                }}
            >
                {src ? "Change Image" : "Select Image"}
            </button>
        </div>

        {/* Invisible Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleFileChange}
        />
      </div>
    </NodeViewWrapper>
  );
};

// --- 2. Tiptap Node Definition ---
const ImageNode = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'image-block' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['image-block', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },
});

// --- 3. Activation ---
export function activate(context: any) {
  context.editor.registerExtension(ImageNode);

  context.commands.registerCommand("image.insert", (args: any) => {
    const editor = context.editor.getSafeInstance();
    if (editor) {
      if (args && args.range) {
          editor.chain().focus().insertContentAt(args.range, { type: 'imageBlock' }).run();
      } else {
          editor.chain().focus().insertContent({ type: 'imageBlock' }).run();
      }
    }
  });
}

export function deactivate() {}