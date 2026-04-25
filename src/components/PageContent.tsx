import { createSignal, onMount, onCleanup } from "solid-js";

type Page = "home" | "about" | "bookshelf";

function pageFromPath(path: string): Page {
  if (path === "/about") return "about";
  if (path === "/bookshelf") return "bookshelf";
  return "home";
}

export default function PageContent() {
  const [page, setPage] = createSignal<Page>(pageFromPath(window.location.pathname));

  const navigate = (p: Page, e: MouseEvent) => {
    e.preventDefault();
    const path = p === "home" ? "/" : `/${p}`;
    history.pushState(null, "", path);
    setPage(p);
  };

  const onPopState = () => setPage(pageFromPath(window.location.pathname));
  onMount(() => window.addEventListener("popstate", onPopState));
  onCleanup(() => window.removeEventListener("popstate", onPopState));

  return (
    <main class="max-w-xl mx-auto px-8 pt-16 text-center relative z-10">
      <h1 class="text-2xl font-semibold text-gray-800 mb-6">mtteo</h1>
      <nav class="flex justify-center gap-6">
        <a
          href="/"
          onClick={(e) => navigate("home", e)}
          class={`transition-colors ${page() === "home" ? "text-gray-800" : "text-gray-500 hover:text-gray-800"}`}
        >home</a>
        <a
          href="/about"
          onClick={(e) => navigate("about", e)}
          class={`transition-colors ${page() === "about" ? "text-gray-800" : "text-gray-500 hover:text-gray-800"}`}
        >about</a>
        <a
          href="/bookshelf"
          onClick={(e) => navigate("bookshelf", e)}
          class={`transition-colors ${page() === "bookshelf" ? "text-gray-800" : "text-gray-500 hover:text-gray-800"}`}
        ><span id="eraser-toggle">b</span>ookshelf</a>
      </nav>

      {page() === "about" && (
        <section class="mt-16 text-left">
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            i'm matteo, i like the internet, cryptography and autonomous vehicles
          </p>
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            i'm building the world i want to live in, while figuring out which world do i want
          </p>
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            tinkering: <a href="https://github.com/MatteoMer/zolt" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">@zolt</a>, a zig based zkvm
          </p>
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            prev: <a href="https://x.com/hyli_org" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">@hyli</a>, <a href="https://x.com/mazuryxyz" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">@mazuryxyz</a>, <a href="https://legalstart.fr" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">@legalstart</a>
          </p>
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            find me on <a href="https://x.com/mtteom_" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">x</a> or <a href="https://github.com/MatteoMer" target="_blank" class="font-bold text-gray-700 hover:text-gray-900">github</a>
          </p>
          <p class="text-sm text-gray-500 leading-relaxed">
            this site is a playground. draw on it, break it, move things around.
          </p>
        </section>
      )}

      {page() === "bookshelf" && (
        <section class="mt-16 text-left">
          <ul class="text-sm text-gray-500 space-y-3">
            <li class="flex justify-between items-baseline">
              <span>the pragmatic programmer</span>
              <span class="text-gray-300 text-xs">hunt & thomas</span>
            </li>
            <li class="flex justify-between items-baseline">
              <span>designing data-intensive applications</span>
              <span class="text-gray-300 text-xs">kleppmann</span>
            </li>
            <li class="flex justify-between items-baseline">
              <span>godel, escher, bach</span>
              <span class="text-gray-300 text-xs">hofstadter</span>
            </li>
            <li class="flex justify-between items-baseline">
              <span>the book of shaders</span>
              <span class="text-gray-300 text-xs">gonzalez & lowe</span>
            </li>
            <li class="flex justify-between items-baseline">
              <span>structure and interpretation of computer programs</span>
              <span class="text-gray-300 text-xs">abelson & sussman</span>
            </li>
            <li class="flex justify-between items-baseline">
              <span>crafting interpreters</span>
              <span class="text-gray-300 text-xs">nystrom</span>
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}
