import { Bold, Italic, Link, Image, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Button } from '../ui';

interface RichTextToolbarProps {
  onAction: (action: string) => void;
}

export default function RichTextToolbar({ onAction }: RichTextToolbarProps) {
  const buttons = [
    { action: 'bold', icon: <Bold size={16} />, title: 'Bold' },
    { action: 'italic', icon: <Italic size={16} />, title: 'Italic' },
    { action: 'link', icon: <Link size={16} />, title: 'Insert Link' },
    { action: 'image', icon: <Image size={16} />, title: 'Insert Image' },
    { action: 'align-left', icon: <AlignLeft size={16} />, title: 'Align Left' },
    { action: 'align-center', icon: <AlignCenter size={16} />, title: 'Align Center' },
    { action: 'align-right', icon: <AlignRight size={16} />, title: 'Align Right' },
  ];

  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      {buttons.map((btn) => (
        <Button
          key={btn.action}
          variant="ghost"
          size="sm"
          title={btn.title}
          onClick={() => onAction(btn.action)}
          type="button"
        >
          {btn.icon}
        </Button>
      ))}
    </div>
  );
}
