import config from '../config.js';

const LEVELS = {silent: -1, error: 0, warn: 1, info: 2, debug: 3};

let threshold = LEVELS[String(config.logLevel).toLowerCase()] ?? LEVELS.info;

/**
 * @param name silent | error | warn | info | debug
 */
export function setLevel(name) {
    threshold = LEVELS[String(name).toLowerCase()] ?? LEVELS.info;
}

export function isEnabled(level) {
    return (LEVELS[level] ?? LEVELS.info) <= threshold;
}

const emit = (level, scope, args) => {
    if (!isEnabled(level)) return;
    const head = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)}${scope ? ` [${scope}]` : ''}`;
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(head, ...args);
};

const build = scope => ({
    error: (...args) => emit('error', scope, args),
    warn: (...args) => emit('warn', scope, args),
    info: (...args) => emit('info', scope, args),
    debug: (...args) => emit('debug', scope, args),
    isEnabled,
    child: name => build(scope ? `${scope}:${name}` : name)
});

export const logger = build('');
export default logger;
