const { call, delay, race } = require('redux-saga/effects')
const { runSaga } = require('redux-saga')

const defaultOptions = {
    //fn: fn or array
    //args: any
    spread: false,
    label: null,
    retryCount: 5,
    indefinite: false,
    timeoutMs: 7500,
    delay: 7500, //number or function
    loglevel: 1
}

function* catchDelay(err, options, retryCount) {
    if (typeof options.delay === 'number') {
        return yield delay(options.delay)
    }
    if (typeof options.delay === 'function') {
        const _delay = yield call(options.delay, err, options, retryCount)
        if (_delay === -1) {
            return -1
        } else {
            return yield delay(_delay)
        }
    }
    throw new Error('bad delay option')
}

function* callWithRetry(_options) {
    const options = {
        ...defaultOptions,
        ..._options
    }
    const errors = []
    for (let i = 0; i < options.retryCount || options.indefinite; i++) {
        try {
            return yield call(_caller, options)
        } catch (err) {
            errors.push(err)
            if (i < options.retryCount - 1 || options.indefinite) {
                const errMsg = [
                    'callWithRetry',
                    options.indefinite && 'indefinite',
                    options.label || options.fn?.name,
                    options.loglevel > 1 && err,
                    options.loglevel > 1 === false && err.message?.substring(0, 200),
                    options.loglevel > 1 === false && err.statusCode
                ].filter(Boolean).join(' ')
                if (options.loglevel > 0) {
                    console.log(errMsg)
                }
                const catchDelayResult = yield call(catchDelay, err, options, i)
                if (catchDelayResult === -1) {
                    break
                }
            }
        }
    }
    const err = new Error(`callWithRetry (${options.label || options.fn?.name}) didn't respond or returned an error after ${options.retryCount} times`)
    err.errors = errors
    throw err
}

function* _caller(options) {
    const { result, timeout } = yield race({
        result: (Array.isArray(options.args) && options.spread) ? call(options.fn, ...options.args) : call(options.fn, options.args),
        timeout: delay(options.timeoutMs)
    })
    if (!timeout) {
        return result
    } else {
        throw new Error(`request timeout (${options.label || options.fn?.name} ${options.timeoutMs} ms)`)
    }
}

const callWithRetryPromise = (options) => new Promise((resolve, reject) => {
    runSaga({}, callWithRetry, options)
        .toPromise()
        .then(resolve, reject)
        .catch(reject)
})

module.exports = {
    callWithRetry,
    callWithRetryPromise,
    _caller
}