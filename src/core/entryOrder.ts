/**
 * 条目头数据顺序的兼容迁移。
 *
 * 现行约定：第一行 `dt` = 岗位/角色，第一条 `:` = 公司/学校/项目名，
 * 最后一条 `:` = 时间。
 *
 * 旧模板把「名称」写在第一行、「岗位」写在第一条 `:` 行。这里做一次
 * 保守迁移：只有第二行明显是岗位、第一行不是岗位时才交换两行。
 * 因此新约定的内容（第一行是岗位）不会被误改，重复执行也不会再交换。
 */

const ROLE_RE =
  /(工程师|负责人|经理|总监|主管|专员|设计师|架构师|开发|实习|顾问|助理|组长|主任|创始人|研究员|研究生|本科生|硕士|博士|学士|CEO|CTO|COO|CFO)/i;

const ENTRY_RE =
  /^([ \t]*)\*\*([^*\n]+)\*\*[ \t]*(\r?\n)([ \t]*):[ \t]*\*\*([^*\n]+)\*\*[ \t]*$/gm;

export const normalizeEntryOrder = (text: string) =>
  text.replace(
    ENTRY_RE,
    (
      match: string,
      lead: string,
      first: string,
      newline: string,
      colonIndent: string,
      second: string
    ) => {
      const firstText = first.trim();
      const secondText = second.trim();

      if (ROLE_RE.test(secondText) && !ROLE_RE.test(firstText)) {
        return `${lead}**${secondText}**${newline}${colonIndent}: **${firstText}**`;
      }

      return match;
    }
  );
