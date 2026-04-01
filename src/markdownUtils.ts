export function inlineFmt(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img alt=\"$1\" src=\"$2\" style=\"max-width:100%\"/>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\">$1</a>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function parseMarkdown(md: string) {
  var lines = md.split("\n");
  var out = "";
  var i = 0;
  while (i < lines.length) {
    var line = lines[i];
    if (line.startsWith("```")) {
      var sl = i;
      i++;
      var code = "";
      while (i < lines.length && !lines[i].startsWith("```")) { code += lines[i] + "\n"; i++; }
      i++;
      out += "<pre data-line=\"" + sl + "\"><code>" + code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").trimEnd() + "</code></pre>\n";
      continue;
    }
    if (/^\|.+\|/.test(line) && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1])) {
      var ts = i;
      var hdrs = line.split("|").filter(Boolean).map(function(h: string) { return "<th>" + inlineFmt(h.trim()) + "</th>"; }).join("");
      i += 2;
      var rows = "";
      while (i < lines.length && /^\|.+\|/.test(lines[i])) {
        rows += "<tr>" + lines[i].split("|").filter(Boolean).map(function(c: string) { return "<td>" + inlineFmt(c.trim()) + "</td>"; }).join("") + "</tr>";
        i++;
      }
      out += "<table data-line=\"" + ts + "\"><thead><tr>" + hdrs + "</tr></thead><tbody>" + rows + "</tbody></table>\n";
      continue;
    }
    var hm = line.match(/^(#{1,6}) (.+)/);
    if (hm) {
      var lvl = hm[1].length;
      out += "<h" + lvl + " data-line=\"" + i + "\">" + inlineFmt(hm[2]) + "</h" + lvl + ">\n";
      i++; continue;
    }
    if (line.startsWith("> ")) {
      out += "<blockquote data-line=\"" + i + "\">" + inlineFmt(line.slice(2)) + "</blockquote>\n";
      i++; continue;
    }
    if (line === "---") {
      out += "<hr data-line=\"" + i + "\"/>\n";
      i++; continue;
    }
    if (/^(\d+)\. /.test(line) || line.startsWith("- ")) {
      var ls = i;
      var isOl = /^(\d+)\. /.test(line);
      var tag = isOl ? "ol" : "ul";
      var items = "";
      while (i < lines.length && (/^(\d+)\. /.test(lines[i]) || lines[i].startsWith("- ") || lines[i].startsWith("  "))) {
        var li = lines[i];
        var cb = li.match(/^[-*] \[(x| )\] (.+)/i);
        if (cb) {
          items += "<li style=\"list-style:none\"><input type=\"checkbox\" disabled" + (cb[1].toLowerCase() === "x" ? " checked" : "") + "/> " + inlineFmt(cb[2]) + "</li>";
        } else {
          items += "<li>" + inlineFmt(li.replace(/^(\d+\. |- )/, "").replace(/^ {2}/, "")) + "</li>";
        }
        i++;
      }
      out += "<" + tag + " data-line=\"" + ls + "\">" + items + "</" + tag + ">\n";
      continue;
    }
    if (line.trim() === "") {
      i++; continue;
    }
    out += "<p data-line=\"" + i + "\">" + inlineFmt(line) + "</p>\n";
    i++;
  }
  return out;
}
