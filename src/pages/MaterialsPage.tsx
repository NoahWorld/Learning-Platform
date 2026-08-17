import { ArrowRight, BookOpen, Clock3, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../components/PageBits";
import type { MaterialListResponse } from "../types";
import { useRemote } from "../useRemote";

export function MaterialsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  const queryString = params.toString();

  const { data, loading, error } = useRemote<MaterialListResponse>(
    (signal) => apiGet(`/api/materials${queryString ? `?${queryString}` : ""}`, signal),
    [queryString],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="standard-page materials-page">
      <PageHeader
        eyebrow="KNOWLEDGE LIBRARY"
        title="学习资料"
        description="按主题慢慢读，把需要记住的内容变成下一次考试的底气。"
      />

      <section className="filter-board" aria-label="资料筛选">
        <form className="search-box" onSubmit={handleSearch}>
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索标题或摘要"
            aria-label="搜索学习资料"
          />
          <button type="submit">搜索</button>
        </form>
        <div className="category-chips" aria-label="资料分类">
          <button className={category === "" ? "active" : ""} onClick={() => setCategory("")}>
            全部
          </button>
          {data?.categories.map((item) => (
            <button
              className={category === item.category ? "active" : ""}
              key={item.category}
              onClick={() => setCategory(item.category)}
            >
              {item.category} <span>{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && data?.materials.length === 0 ? (
        <EmptyState
          title={search || category ? "没有找到匹配资料" : "资料库还是空的"}
          description={
            search || category
              ? "换个关键词或清除分类筛选再试试。"
              : "录入第一批学习内容后，资料会自动按分类排列在这里。"
          }
        />
      ) : null}

      {data?.materials.length ? (
        <div className="material-grid">
          {data.materials.map((material, index) => (
            <Link className={`material-card tone-${(index % 4) + 1}`} to={`/materials/${material.id}`} key={material.id}>
              <div className="material-cover">
                {material.coverUrl ? (
                  <img src={material.coverUrl} alt="" loading="lazy" />
                ) : (
                  <>
                    <BookOpen size={42} aria-hidden="true" />
                    <span>READ #{String(index + 1).padStart(2, "0")}</span>
                  </>
                )}
              </div>
              <div className="material-body">
                <span className="material-category">{material.category}</span>
                <h2>{material.title}</h2>
                <p>{material.summary || "这篇资料暂时没有摘要。"}</p>
                <div className="material-meta">
                  <span><Clock3 size={15} /> {material.estimatedMinutes || "—"} 分钟</span>
                  <span>开始阅读 <ArrowRight size={16} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
