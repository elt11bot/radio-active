// Generated by CoffeeScript 1.7.1
(function() {
  var Base, BasicEventEmitter, BasicEventEmitterHandler, DEBUG, DEFAULT_LOOP_DELAY, GLOBAL, Iterator, LOOP_ITERATIONS_TO_SURVIVE, Loop, Monitor, MonitorListenerProxy, Notifier, NotifierPool, PartialResultMarker, ReactiveEval, ReactiveEvalResult, StackVal, StopSignal, Token, Try, WaitSignal, build_cell, build_public_api, compare_semver, conditional_build, debug_error, fork, in_browser, is_special_error, loop_with_callback, next_tick, serial, syncify, tap, version, _serial,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  _serial = 0;

  serial = function() {
    return _serial++;
  };

  DEBUG = true;

  DEFAULT_LOOP_DELAY = 50;

  LOOP_ITERATIONS_TO_SURVIVE = 2;

  is_special_error = function(e) {
    return (e instanceof WaitSignal) || (e instanceof StopSignal);
  };

  debug_error = function(e) {
    if (DEBUG && (e != null) && !is_special_error(e)) {
      return console.log(e);
    }
  };

  next_tick = function(f) {
    return setTimeout(f, 1);
  };

  tap = function(v) {
    return function(f) {
      f(v);
      return v;
    };
  };

  WaitSignal = (function(_super) {
    __extends(WaitSignal, _super);

    function WaitSignal() {
      WaitSignal.__super__.constructor.call(this);
    }

    return WaitSignal;

  })(Error);

  StopSignal = (function(_super) {
    __extends(StopSignal, _super);

    function StopSignal() {
      StopSignal.__super__.constructor.call(this);
    }

    return StopSignal;

  })(Error);

  BasicEventEmitter = (function() {
    function BasicEventEmitter() {
      this._request_cleanup = false;
      this._handlers = [];
    }

    BasicEventEmitter.prototype.emit = function(type, payload) {
      this._handlers.forEach((function(_this) {
        return function(h) {
          if ((h.type === type) && (h.fire(payload) === 0)) {
            return _this._request_cleanup = true;
          }
        };
      })(this));
      return this._cleanup();
    };

    BasicEventEmitter.prototype.on = function(type, f) {
      return this._upsert(type, f, -1);
    };

    BasicEventEmitter.prototype.once = function(type, f) {
      return this._upsert(type, f, 1);
    };

    BasicEventEmitter.prototype.off = function(type, f) {
      return this._upsert(type, f, 0);
    };

    BasicEventEmitter.prototype.removeListener = function(type, f) {
      return this.off(type, f);
    };

    BasicEventEmitter.prototype.removeAllListeners = function() {
      return this._handlers = [];
    };

    BasicEventEmitter.prototype._cleanup = function() {
      var h;
      if (this._request_cleanup) {
        this._request_cleanup = false;
        return this._handlers = (function() {
          var _i, _len, _ref, _results;
          _ref = this._handlers;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            h = _ref[_i];
            if (h.remaining !== 0) {
              _results.push(h);
            }
          }
          return _results;
        }).call(this);
      }
    };

    BasicEventEmitter.prototype._find_handler = function(type, f) {
      var h, _i, _len, _ref;
      _ref = this._handlers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        h = _ref[_i];
        if (h.equals(type, f)) {
          return h;
        }
      }
      return void 0;
    };

    BasicEventEmitter.prototype._upsert = function(type, f, q) {
      var x;
      if ((x = this._find_handler(type, f)) != null) {
        x.update(q);
      } else {
        if (q === 0) {
          return;
        }
        this._handlers.push(new BasicEventEmitterHandler(type, f, q));
      }
      if (q === 0) {
        this._request_cleanup = true;
        return this._cleanup();
      }
    };

    return BasicEventEmitter;

  })();

  BasicEventEmitterHandler = (function() {
    function BasicEventEmitterHandler(type, func, remaining) {
      this.type = type;
      this.func = func;
      this.remaining = remaining != null ? remaining : -1;
    }

    BasicEventEmitterHandler.prototype.update = function(q) {
      if (this.remaining < 0 && q === 1) {
        return;
      }
      return this.remaining = q;
    };

    BasicEventEmitterHandler.prototype.fire = function(e) {
      if (this.remaining !== 0) {
        this.remaining--;
        this.func(e);
      }
      return this.remaining;
    };


    /*
    equals(type:string, func:CB):boolean;
    equals(other:Handler):boolean;
     */

    BasicEventEmitterHandler.prototype.equals = function(type, func) {
      if (type instanceof BasicEventEmitterHandler) {
        func = type.func;
        type = type.type;
      }
      return (this.type === type) && (this.func === func);
    };

    return BasicEventEmitterHandler;

  })();

  StackVal = (function() {
    function StackVal() {
      this.stack = [];
    }

    StackVal.prototype.defined = function() {
      return this.stack.length > 0;
    };

    StackVal.prototype.run = function(expr, build) {
      try {
        this.stack.push(build());
        return expr();
      } finally {
        this.stack.pop();
      }
    };

    StackVal.prototype.get = function() {
      if (this.defined()) {
        return this.stack[this.stack.length - 1];
      } else {
        throw new Error("No value found upstack");
      }
    };

    return StackVal;

  })();

  Base = (function(_super) {
    __extends(Base, _super);

    function Base() {
      Base.__super__.constructor.call(this);
    }

    return Base;

  })(BasicEventEmitter);

  Notifier = (function(_super) {
    __extends(Notifier, _super);

    function Notifier(monitor) {
      this.monitor = monitor;
      Notifier.__super__.constructor.call(this);
    }

    Notifier.prototype.fire = function() {
      return this.monitor.fire(this);
    };

    Notifier.prototype.cancel = function() {};

    Notifier.prototype.is_active = function() {
      return true;
    };

    Notifier.prototype.public_api = function() {
      var api;
      api = (function(_this) {
        return function() {
          return _this.fire();
        };
      })(this);
      api.once = (function(_this) {
        return function(h) {
          return _this.once(h);
        };
      })(this);
      api.off = (function(_this) {
        return function(h) {
          return _this.off(h);
        };
      })(this);
      return api;
    };

    return Notifier;

  })(Base);

  NotifierPool = (function(_super) {
    __extends(NotifierPool, _super);

    function NotifierPool() {
      NotifierPool.__super__.constructor.call(this);
      this.notifiers = [];
    }

    NotifierPool.prototype.allocate = function() {
      if (ReactiveEval.active()) {
        return this.notifiers.push(ReactiveEval.notifier());
      }
    };

    NotifierPool.prototype.cancel = function() {
      return this._each(function(n) {
        return n.cancel();
      });
    };

    NotifierPool.prototype.fire = function() {
      return this._each(function(n) {
        return n.fire();
      });
    };

    NotifierPool.prototype.monitor_cancelled = function() {
      return this._each(function(n) {
        return n.monitor_cancelled();
      });
    };

    NotifierPool.prototype.sibling_fired = function() {
      return this._each(function(n) {
        return n.sibling_fired();
      });
    };

    NotifierPool.prototype.is_active = function() {
      var n, _i, _len, _ref;
      _ref = this.notifiers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        n = _ref[_i];
        if (n.is_active()) {
          return true;
        }
      }
      return false;
    };

    NotifierPool.prototype._each = function(f) {
      var ns;
      ns = this.notifiers;
      this.notifiers = [];
      return ns.forEach(f);
    };

    return NotifierPool;

  })(Base);

  Monitor = (function(_super) {
    __extends(Monitor, _super);

    function Monitor() {
      Monitor.__super__.constructor.call(this);
      this.notifiers = [];
    }

    Monitor.prototype.notifier = function() {
      var n;
      this.notifiers.push(n = new Notifier(this));
      return n;
    };

    Monitor.prototype.fire = function() {
      return next_tick((function(_this) {
        return function() {
          return _this.emit('fire');
        };
      })(this));
    };

    Monitor.prototype.bubble = function() {
      var n;
      if (ReactiveEval.active()) {
        n = ReactiveEval.notifier();
        return this.once('fire', function() {
          return n.fire();
        });
      }
    };

    Monitor.join = function(monitors) {
      var cb, len, notifier;
      if (ReactiveEval.active()) {
        notifier = ReactiveEval.notifier();
        len = monitors.length;
        cb = function() {
          if (--len === 0) {
            return notifier.fire();
          }
        };
        return monitors.forEach(function(m) {
          return m.once('fire', cb);
        });
      }
    };

    return Monitor;

  })(Base);

  MonitorListenerProxy = (function() {
    function MonitorListenerProxy(handler) {
      this.handler = handler;
    }

    MonitorListenerProxy.prototype.swap = function(m) {
      var _ref, _ref1;
      if ((_ref = this.monitor) != null) {
        _ref.off('fire', this.handler);
      }
      this.monitor = m;
      return (_ref1 = this.monitor) != null ? _ref1.once('fire', this.handler) : void 0;
    };

    return MonitorListenerProxy;

  })();

  Try = (function() {
    function Try(error, result) {
      this.error = error;
      this.result = result;
    }

    Try.prototype.get = function() {
      if (this.error != null) {
        throw this.error;
      }
      return this.result;
    };

    Try.prototype.compare = function(other, comparator) {
      if (comparator == null) {
        comparator = void 0;
      }
      if (comparator == null) {
        comparator = function(a, b) {
          return a === b;
        };
      }
      if (!(other instanceof Try)) {
        return false;
      }
      if ((other.error != null) || (this.error != null)) {
        return comparator(other.error, this.error);
      } else {
        return comparator(other.result, this.result);
      }
    };

    Try["eval"] = function(expr) {
      var e;
      try {
        return new Try(null, expr());
      } catch (_error) {
        e = _error;
        return new Try(e);
      }
    };

    Try["null"] = new Try(null, null);

    return Try;

  })();

  Token = (function() {
    function Token() {}

    Token.prototype.result = null;

    Token.prototype.partial = false;

    Token.prototype.monitor = null;

    return Token;

  })();

  Iterator = (function(_super) {
    __extends(Iterator, _super);

    Iterator.prototype.expired = true;

    Iterator.prototype.last_token = null;

    Iterator.prototype.iteration_count = 0;

    function Iterator(expr) {
      this.add_to_stack = __bind(this.add_to_stack, this);
      this.update_counters = __bind(this.update_counters, this);
      this.invalidate_service_caches = __bind(this.invalidate_service_caches, this);
      Iterator.__super__.constructor.call(this);
      this.expr = this.add_to_stack(this.invalidate_service_caches(this.mark_partials(this.attach_monitors(this.update_counters(this.tokenize(expr))))));
      this.monitor_listener = new MonitorListenerProxy((function(_this) {
        return function() {
          _this.expired = true;
          return _this.emit('change');
        };
      })(this));
      this.cache = {};
    }

    Iterator.prototype.refresh = function() {
      var t;
      if (this.expired) {
        this.expired = false;
        t = this.expr();
        this.monitor_listener.swap(t.monitor);
        this.last_token = t;
        debug_error(t.result.error);
        return true;
      } else {
        return false;
      }
    };

    Iterator.prototype.current = function() {
      if (this.waiting()) {
        return Try["null"];
      } else {
        return this.last_token.result;
      }
    };

    Iterator.prototype.waiting = function() {
      return this.last_token.result.error instanceof WaitSignal;
    };

    Iterator.prototype.expireable = function() {
      if (this.last_token != null) {
        return this.last_token.monitor != null;
      } else {
        return true;
      }
    };

    Iterator.prototype.close = function() {
      var _ref, _ref1;
      if ((_ref = this.last_token) != null) {
        if ((_ref1 = _ref.monitor) != null) {
          _ref1.cancel();
        }
      }
      this.monitor_listener.swap(null);
      return this.cache = {};
    };

    Iterator.prototype.tokenize = function(expr) {
      return function() {
        return tap(new Token)(function(t) {
          return t.result = Try["eval"](expr);
        });
      };
    };

    Iterator.prototype.attach_monitors = function(stream) {
      return function() {
        var r;
        r = ReactiveEval["eval"](stream);
        return tap(r.result)(function(t) {
          return t.monitor = r.monitor;
        });
      };
    };

    Iterator.prototype.mark_partials = function(stream) {
      return function() {
        var prm;
        prm = new PartialResultMarker;
        return tap(prm.run(stream))(function(t) {
          return t.partial = prm.marked;
        });
      };
    };

    Iterator.prototype.invalidate_service_caches = function(stream) {
      return (function(_this) {
        return function() {
          return tap(stream())(function(t) {
            if (!(t.partial || t.result.error instanceof WaitSignal)) {
              return _this.cache = {};
            }
          });
        };
      })(this);
    };

    Iterator.prototype.update_counters = function(stream) {
      return (function(_this) {
        return function() {
          return tap(stream())(function() {
            return _this.iteration_count++;
          });
        };
      })(this);
    };

    Iterator.prototype.add_to_stack = function(stream) {
      return (function(_this) {
        return function() {
          return Iterator.stack.run(stream, function() {
            return _this;
          });
        };
      })(this);
    };

    Iterator.stack = new StackVal;

    Iterator.current_cache = function() {
      return this.stack.get().cache;
    };

    return Iterator;

  })(Base);

  Loop = (function(_super) {
    __extends(Loop, _super);

    function Loop(expr, opts) {
      var _base, _base1;
      this.opts = opts != null ? opts : null;
      this.stop = __bind(this.stop, this);
      this.loop = __bind(this.loop, this);
      Loop.__super__.constructor.call(this);
      if (this.opts == null) {
        this.opts = {};
      }
      if ((_base = this.opts).debounce == null) {
        _base.debounce = DEFAULT_LOOP_DELAY;
      }
      if ((_base1 = this.opts).detached == null) {
        _base1.detached = true;
      }
      this.iter = new Iterator((function(_this) {
        return function() {
          return Loop.stack.run(expr, function() {
            return _this;
          });
        };
      })(this));
      this._attach_to_parent();
      this._request_loop();
    }

    Loop.prototype._request_loop = function() {
      if (this.loop_timeout != null) {
        clearTimeout(this.loop_timeout);
      }
      return this.loop_timeout = setTimeout(this.loop, this.opts.debounce);
    };

    Loop.prototype.loop = function() {
      if (this._eol_heuristics()) {
        this.iter.refresh();
        if (this.iter.current().error instanceof StopSignal) {
          return this.stop();
        } else {
          return this.iter.once("change", (function(_this) {
            return function() {
              return _this._request_loop();
            };
          })(this));
        }
      } else {
        return this.stop();
      }
    };

    Loop.prototype.iteration_count = function() {
      return this.iter.iteration_count;
    };

    Loop.prototype.stop = function() {
      if (this.loop_timeout != null) {
        clearTimeout(this.loop_timeout);
      }
      return this.iter.close();
    };

    Loop.prototype._eol_heuristics = function() {
      var iterations_we_have_lived;
      if (this.parent != null) {
        iterations_we_have_lived = this.parent.iteration_count() - this.parent_iteration_count;
        if (iterations_we_have_lived > LOOP_ITERATIONS_TO_SURVIVE) {
          return false;
        }
      }
      return true;
    };

    Loop.prototype.parent = void 0;

    Loop.prototype.parent_iteration_count = void 0;

    Loop.prototype._attach_to_parent = function() {
      if (!this.opts.detached) {
        if (Loop.stack.defined()) {
          this.parent = Loop.stack.get;
          return this.parent_iteration_count = this.parent.iteration_count();
        }
      }
    };

    Loop.stack = new StackVal;

    return Loop;

  })(Base);

  syncify = function(async_func, global) {
    var api, cache, id, instance_scoped_cache_lazy;
    if (global == null) {
      global = false;
    }
    id = serial();
    instance_scoped_cache_lazy = void 0;
    cache = function() {
      var build, instance_scoped, iteration_scoped;
      build = function() {
        var cells, get, reset;
        cells = {};
        get = function(args) {
          var _name;
          if (args.length !== async_func.length - 1) {
            throw new Error('Wrong number of arguments for syncified function ' + async_func.toString());
          }
          return (cells[_name = JSON.stringify(args)] != null ? cells[_name] : cells[_name] = (function() {
            var c;
            c = build_cell(new WaitSignal);
            async_func.apply(null, args.concat([c]));
            return c;
          })())();
        };
        reset = function(filter) {
          var k, v, _results;
          _results = [];
          for (k in cells) {
            if (!__hasProp.call(cells, k)) continue;
            v = cells[k];
            if ((filter == null) || filter(JSON.parse(k))) {
              if (v.monitored()) {
                _results.push(c(new WaitSignal));
              } else {
                _results.push(delete cells[k]);
              }
            }
          }
          return _results;
        };
        return {
          get: get,
          reset: reset
        };
      };
      iteration_scoped = function() {
        var _base;
        return (_base = Iterator.current_cache())[id] != null ? _base[id] : _base[id] = build();
      };
      instance_scoped = function() {
        return instance_scoped_cache_lazy != null ? instance_scoped_cache_lazy : instance_scoped_cache_lazy = build();
      };
      if (global) {
        return instance_scoped();
      } else {
        return iteration_scoped();
      }
    };
    api = function() {
      return cache().get(Array.prototype.slice.apply(arguments));
    };
    api.reset = function(filter) {
      return instance_scoped_cache().reset(filter);
    };
    return api;
  };

  fork = function() {
    var api, monitors, waits;
    waits = 0;
    monitors = [];
    api = function(expr) {
      var res;
      res = ReactiveEval["eval"](expr);
      if (res.result.error instanceof WaitSignal) {
        if (res.monitor == null) {
          throw new Error('You cannot throw a WaitSignal from a non reactive function - it will never resolve');
        }
        waits++;
        monitors.push(res.monitor);
        return null;
      } else {
        return res.unbox();
      }
    };
    api.join = function() {
      Monitor.join(monitors);
      if (waits > 0) {
        throw new WaitSignal;
      }
      return void 0;
    };
    return api;
  };

  PartialResultMarker = (function() {
    function PartialResultMarker() {
      this.mark = __bind(this.mark, this);
    }

    PartialResultMarker.prototype.flag = false;

    PartialResultMarker.prototype.run = function(expr) {
      return PartialResultMarker.stack.run(expr, (function(_this) {
        return function() {
          return _this;
        };
      })(this));
    };

    PartialResultMarker.prototype.mark = function() {
      return this.flag = true;
    };

    PartialResultMarker.prototype.marked = function() {
      return this.flag;
    };

    PartialResultMarker.stack = new StackVal;

    PartialResultMarker.mark = function() {
      return this.stack.get().mark();
    };

    return PartialResultMarker;

  })();

  ReactiveEval = (function() {
    function ReactiveEval(expr) {
      this.expr = expr;
    }

    ReactiveEval.prototype.lazy_monitor = function() {
      return this._monitor != null ? this._monitor : this._monitor = new Monitor;
    };

    ReactiveEval.prototype.run = function() {
      var t;
      t = Try["eval"](this.expr);
      return new ReactiveEvalResult(t, this._monitor);
    };

    ReactiveEval.prototype.allocate_notifier = function() {
      return this.lazy_monitor().notifier();
    };

    ReactiveEval.stack = [];

    ReactiveEval.notifier = function() {
      var _ref;
      return (_ref = this.stack[this.stack.length - 1]) != null ? _ref.allocate_notifier() : void 0;
    };

    ReactiveEval.active = function() {
      return this.stack.length > 0;
    };

    ReactiveEval["eval"] = function(expr) {
      var r, rev;
      rev = new ReactiveEval(expr);
      this.stack.push(rev);
      r = rev.run();
      this.stack.pop();
      return r;
    };

    return ReactiveEval;

  })();

  ReactiveEvalResult = (function() {
    function ReactiveEvalResult(result, monitor) {
      this.result = result;
      this.monitor = monitor;
    }

    ReactiveEvalResult.prototype.unbox = function() {
      var _ref;
      if ((_ref = this.monitor) != null) {
        _ref.bubble();
      }
      return this.result.get();
    };

    return ReactiveEvalResult;

  })();

  build_cell = function(initial_value) {
    var api, doget, doset, notifiers, value;
    value = void 0;
    notifiers = new NotifierPool;
    doget = function() {
      notifiers.allocate();
      if (value != null) {
        return value.get();
      } else {
        return void 0;
      }
    };
    doset = function(v) {
      var new_t;
      new_t = v instanceof Error ? new Try(v) : new Try(null, v);
      if (new_t.compare(value)) {
        return;
      }
      value = new_t;
      return notifiers.fire();
    };
    api = function() {
      var a;
      a = arguments;
      switch (a.length) {
        case 0:
          return doget();
        case 1:
          return doset(a[0]);
        case 2:
          if (a[0] != null) {
            return doset(a[0]);
          } else {
            return doset(a[1]);
          }
      }
    };
    api.get = function() {
      return api();
    };
    api.set = function(v) {
      return api(v);
    };
    api.monitored = function() {
      return notifiers.is_active();
    };
    if (initial_value != null) {
      api(initial_value);
    }
    return api;
  };

  loop_with_callback = function(expr, cb) {
    var stop_flag;
    stop_flag = false;
    radioactive.loop(function() {
      var e;
      if (stop_flag) {
        radioactive.stop();
      }
      try {
        return cb(null, expr());
      } catch (_error) {
        e = _error;
        if (is_special_error(e)) {
          throw e;
        }
        return cb(e);
      }
    });
    return function() {
      return stop_flag = true;
    };
  };

  build_public_api = function() {
    var internals, radioactive;
    radioactive = function() {
      var a;
      a = arguments;
      switch (typeof a[0]) {
        case 'function':
          return radioactive.loop(a[0]);
        default:
          return build_cell(a[0]);
      }
    };
    radioactive.cell = build_cell;
    radioactive.active = function() {
      return ReactiveEval.active();
    };
    radioactive.notifier = function() {
      var _ref;
      return (_ref = ReactiveEval.notifier()) != null ? _ref.public_api() : void 0;
    };
    radioactive.wait = function() {
      throw new WaitSignal;
    };
    radioactive.stop = function() {
      throw new StopSignal;
    };
    radioactive.fork = fork;
    radioactive.mute = function(expr) {
      return function() {
        var res, _ref;
        res = RadioactiveEval["eval"](expr);
        if ((_ref = res.monitor) != null) {
          _ref.cancel();
        }
        if (is_special_error(res.result.error)) {
          delete res.result.error;
        }
        return res.result;
      };
    };
    radioactive.loop = function() {
      var a;
      a = arguments;
      switch (typeof a[0] + ' ' + typeof a[1]) {
        case 'function undefined':
          return new Loop(a[0]);
        case 'function function':
          return loop_with_callback(a[0], a[1]);
      }
    };
    radioactive.once = function(expr) {
      return radioactive.loop(function() {
        expr();
        return radioactive.stop();
      });
    };
    radioactive.waiting = function(expr) {
      var e;
      try {
        expr();
        return false;
      } catch (_error) {
        e = _error;
        if (e instanceof WaitSignal) {
          PartialResultMarker.mark();
          return true;
        } else {
          return false;
        }
      }
    };
    radioactive.syncify = syncify;
    radioactive.echo = function(delay) {
      var cells;
      if (delay == null) {
        delay = 1000;
      }
      cells = {};
      return function(message) {
        return (cells[message] != null ? cells[message] : cells[message] = (function() {
          var c;
          setTimeout((function() {
            return c(message);
          }), delay);
          return c = build_cell(new WaitSignal);
        })())();
      };
    };
    radioactive.time = function(interval) {
      if (interval == null) {
        interval = 1000;
      }
      if (interval > 0 && ReactiveEval.active()) {
        setTimeout(radioactive.notifier(), interval);
      }
      return new Date().getTime();
    };
    radioactive.WaitSignal = WaitSignal;

    /*
      Exported internals ( for unit testing only )
     */
    radioactive._internals = internals = {};
    internals.Monitor = Monitor;
    internals.Notifier = Notifier;
    internals.ReactiveEval = ReactiveEval;
    internals.BasicEventEmitter = BasicEventEmitter;
    return radioactive;
  };

  compare_semver = function(v1, v2) {
    var arr, i, x, x1, x2, _i, _len;
    v1 = (function() {
      var _i, _len, _ref, _results;
      _ref = v1.split('.');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        x = _ref[_i];
        _results.push(Number(x));
      }
      return _results;
    })();
    v2 = (function() {
      var _i, _len, _ref, _results;
      _ref = v2.split('.');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        x = _ref[_i];
        _results.push(Number(x));
      }
      return _results;
    })();
    arr = (function() {
      var _i, _len, _results;
      _results = [];
      for (i = _i = 0, _len = v1.length; _i < _len; i = ++_i) {
        x1 = v1[i];
        x2 = v2[i];
        if (x1 > x2) {
          _results.push('GT');
        } else if (x1 < x2) {
          _results.push('LT');
        } else {
          _results.push('EQ');
        }
      }
      return _results;
    })();
    for (_i = 0, _len = arr.length; _i < _len; _i++) {
      x = arr[_i];
      if (x === 'GT') {
        return 'GT';
      }
      if (x === 'LT') {
        return 'LT';
      }
    }
    return 'EQ';
  };

  version = '0.0.1';

  in_browser = false;

  try {
    if (typeof window !== "undefined" && window !== null) {
      in_browser = true;
    }
  } catch (_error) {}

  GLOBAL = in_browser ? window : global;

  (conditional_build = function() {
    var create, other, other_version;
    create = false;
    if ((other = GLOBAL.radioactive) != null) {
      other_version = other.version || '0.0.0';
      if (compare_semver(version, other_version) === 'GT') {
        create = true;
      }
    } else {
      create = true;
    }
    if (create) {
      return GLOBAL.radioactive = build_public_api();
    }
  })();

  try {
    module.exports = GLOBAL.radioactive;
  } catch (_error) {}

}).call(this);
