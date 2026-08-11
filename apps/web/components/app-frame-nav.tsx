"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/finance", label: "财务" },
  { href: "/content", label: "内容" },
  { href: "/ai", label: "AI" },
  { href: "/health", label: "健康" },
  { href: "/tools", label: "工具" }
];

function getQuickAction(pathname: string) {
  if (pathname.startsWith("/finance")) {
    return {
      href: "/finance#capture",
      label: "快速记账"
    };
  }

  if (pathname.startsWith("/content")) {
    return {
      href: "/content#task",
      label: "新建任务"
    };
  }

  if (pathname.startsWith("/ai")) {
    return {
      href: "/ai",
      label: "AI 配置"
    };
  }

  if (pathname.startsWith("/health")) {
    return {
      href: "/health",
      label: "健康规划"
    };
  }

  if (pathname.startsWith("/growth")) {
    return {
      href: "/growth",
      label: "成长规划"
    };
  }

  if (pathname.startsWith("/tools")) {
    return {
      href: "/tools",
      label: "新建便签"
    };
  }

  return {
    href: "/content",
    label: "进入内容"
  };
}

export function AppFrameNav() {
  const pathname = usePathname();
  const quickAction = getQuickAction(pathname);
  const searchPlaceholder = pathname.startsWith("/tools") ? "搜索工具..." : "搜索系统...";
  const isAiRoute = pathname.startsWith("/ai");

  return (
    <>
      <nav className="app-frame__nav" aria-label="primary">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              className={`app-frame__nav-link ${
                isActive ? "app-frame__nav-link--active" : ""
              }`}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-frame__tools">
        <label className="app-frame__search">
          <span className="sr-only">搜索系统</span>
          <input type="search" placeholder={searchPlaceholder} />
        </label>
        {!isAiRoute ? (
          <Link className="primary-button app-frame__action" href={quickAction.href}>
            {quickAction.label}
          </Link>
        ) : null}
      </div>
    </>
  );
}
