import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>这页知识点走丢了</h1>
      <p>返回工作台，继续你的学习路线。</p>
      <Link className="comic-button dark" to="/"><ArrowLeft size={17} /> 返回首页</Link>
    </div>
  );
}
