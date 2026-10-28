// RFC 9309 subset: longest matching path rule wins, Allow wins equal length.
// Unknown directives do not grant permission. A failed robots fetch denies the page.
export function robotsAllowed(text: string, url: string, agent = 'ClonAIResearch'): boolean {
    const groups: {
        agents: string[];
        rules: {
            allow: boolean;
            path: string;
        }[];
    }[] = [];
    let group: {
        agents: string[];
        rules: {
            allow: boolean;
            path: string;
        }[];
    } | null = null;
    for (const line of text.split(/\r?\n/)) {
        const pair = line.replace(/#.*$/, '').match(/^\s*([^:]+):\s*(.*?)\s*$/);
        if (!pair)
            continue;
        const key = pair[1].toLowerCase(), value = pair[2];
        if (key === 'user-agent') {
            if (!group || group.rules.length) {
                group = { agents: [], rules: [] };
                groups.push(group);
            }
            group.agents.push(value.toLowerCase());
        }
        else if (group && (key === 'allow' || key === 'disallow') && value)
            group.rules.push({ allow: key === 'allow', path: value });
    }
    const specific = groups.filter(g => g.agents.some(a => a !== '*' && agent.toLowerCase().includes(a))), chosen = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
    const path = new URL(url).pathname + new URL(url).search;
    const rules = chosen.flatMap(g => g.rules).filter(r => { const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'); return new RegExp('^' + pattern).test(path); }).sort((a, b) => b.path.replace(/\*/g, '').length - a.path.replace(/\*/g, '').length || Number(b.allow) - Number(a.allow));
    return rules[0]?.allow ?? true;
}
