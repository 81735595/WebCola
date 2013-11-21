///<reference path="vpsc.ts"/>
///<reference path="rbtree.d.ts"/>
module vpsc {
    export interface Leaf {
        bounds: Rectangle;
        variable: Variable;
    }

    export interface Group {
        bounds: Rectangle;
        padding: number;
        leaves: Leaf[];
        groups: Group[];
        minVar: Variable;
        maxVar: Variable;
        minRect: Rectangle;
        maxRect: Rectangle;
    }

    export function computeGroupBounds(g: Group): Rectangle {
        g.bounds = g.leaves.reduce((r, c) => c.bounds.union(r), Rectangle.empty());
        if (typeof g.groups !== "undefined")
            g.bounds = g.groups.reduce((r, c) => computeGroupBounds(c).union(r), g.bounds);
        return g.bounds;
    }

    export class Rectangle {
        x: number;
        X: number;
        y: number;
        Y: number;

        constructor(x: number, X: number, y: number, Y: number) {
            this.x = x;
            this.X = X;
            this.y = y;
            this.Y = Y;
        }

        static empty(): Rectangle { return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY); }

        cx(): number { return (this.x + this.X) / 2; }

        cy(): number { return (this.y + this.Y) / 2; }

        overlapX(r: Rectangle): number {
            var ux = this.cx(), vx = r.cx();
            if (ux <= vx && r.x < this.X) return this.X - r.x;
            if (vx <= ux && this.x < r.X) return r.X - this.x;
            return 0;
        }

        overlapY(r: Rectangle): number {
            var uy = this.cy(), vy = r.cy();
            if (uy <= vy && r.y < this.Y) return this.Y - r.y;
            if (vy <= uy && this.y < r.Y) return r.Y - this.y;
            return 0;
        }

        setXCentre(cx: number): void {
            var dx = cx - this.cx();
            this.x += dx;
            this.X += dx;
        }

        setYCentre(cy: number): void {
            var dy = cy - this.cy();
            this.y += dy;
            this.Y += dy;
        }

        width(): number {
            return this.X - this.x;
        }

        height(): number {
            return this.Y - this.y;
        }

        union(r: Rectangle): Rectangle {
            return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
        }
    }

    class Node {
        v: Variable;
        r: Rectangle;
        pos: number;
        prev: RBTree<Node>;
        next: RBTree<Node>;

        constructor(v: Variable, r: Rectangle, p: number) {
            this.v = v;
            this.r = r;
            this.pos = p;
            this.prev = makeRBTree();
            this.next = makeRBTree();
        }
    }

    class Event {
        isOpen: boolean;
        v: Node;
        pos: number;

        constructor(isOpen: boolean, v: Node, p: number) {
            this.isOpen = isOpen;
            this.v = v;
            this.pos = p;
        }
    }

    function compareEvents(a: Event, b: Event): number {
        if (a.pos > b.pos) {
            return 1;
        }
        if (a.pos < b.pos) {
            return -1;
        }
        if (a.isOpen) {
            // open must come before close
            return -1;
        }
        return 0;
    }

    function makeRBTree(): RBTree<Node> {
        return new RBTree<Node>((a, b) => a.pos - b.pos);
    }

    interface RectAccessors {
        getCentre: (r: Rectangle) => number;
        getOpen: (r: Rectangle) => number;
        getClose: (r: Rectangle) => number;
        getSize: (r: Rectangle) => number;
        makeRect: (open: number, close: number, center: number, size: number) => Rectangle;
        findNeighbours: (v: Node, scanline: RBTree<Node>) => void;
    }

    var xRect: RectAccessors = {
        getCentre: r=> r.cx(),
        getOpen: r=> r.y,
        getClose: r=> r.Y,
        getSize: r=> r.width(),
        makeRect: (open, close, center, size) => new Rectangle(center - size / 2, center + size / 2, open, close) ,
        findNeighbours: findXNeighbours
    };

    var yRect: RectAccessors = {
        getCentre: r=> r.cy(),
        getOpen: r=> r.x,
        getClose: r=> r.X,
        getSize: r=> r.height(),
        makeRect: (open, close, center, size) => new Rectangle(open, close, center - size / 2, center + size / 2),
        findNeighbours: findYNeighbours
    };

    function generateGroupConstraints(root: Group, rect: RectAccessors, minSep: number, isContained: boolean = false): Constraint[]
    {
        var padding = typeof root.padding === 'undefined' ? 1 : root.padding;
        var childConstraints: Constraint[] = [];
        var gn = typeof root.groups !== 'undefined' ? root.groups.length : 0,
            ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0;
        if (gn) root.groups.forEach(g => {
            childConstraints = childConstraints.concat(generateGroupConstraints(g, rect, minSep, true));
        });
        var n = (isContained ? 2 : 0) + ln + gn;
        var vs: Variable[] = new Array(n);
        var rs: Rectangle[] = new Array(n);
        var i = 0;
        if (isContained) {
            var c = rect.getCentre(root.bounds),
                s = rect.getSize(root.bounds) / 2;
            rs[i] = root.minRect = rect.makeRect(rect.getOpen(root.bounds), rect.getClose(root.bounds), c - s, padding);
            root.minVar.desiredPosition = rect.getCentre(root.minRect);
            vs[i++] = root.minVar;
            rs[i] = root.maxRect = rect.makeRect(rect.getOpen(root.bounds), rect.getClose(root.bounds), c + s, padding);
            root.minVar.desiredPosition = rect.getCentre(root.maxRect);
            vs[i++] = root.maxVar;
        }
        if (ln) root.leaves.forEach(l => {
            rs[i] = l.bounds;
            vs[i++] = l.variable;
        });
        if (gn) root.groups.forEach(g => {
            rs[i] = g.minRect = rect.makeRect(rect.getOpen(g.bounds), rect.getClose(g.bounds), rect.getCentre(g.bounds), rect.getSize(g.bounds));
            vs[i++] = g.minVar;
        });
        var cs = generateConstraints(rs, vs, rect, minSep);
        if (gn) {
            vs.forEach(v => {
                v.cOut = [];
                v.cIn = [];
            });
            cs.forEach(c => {
                c.left.cOut.push(c);
                c.right.cIn.push(c);
            });
            root.groups.forEach(g => {
                g.minVar.cIn.forEach(c => {
                    c.gap += (padding - rect.getSize(g.bounds)) / 2;
                });
                g.minVar.cOut.forEach(c => {
                    c.left = g.maxVar;
                    c.gap += (padding - rect.getSize(g.bounds)) / 2;
                });
            });
        }
        return childConstraints.concat(cs);
    }

    function generateConstraints(rs: Rectangle[], vars: Variable[],
        rect: RectAccessors, minSep: number): Constraint[]
    {
        var i, n = rs.length;
        var N = 2 * n;
        console.assert(vars.length >= n);
        var events = new Array<Event>(N);
        for (i = 0; i < n; ++i) {
            var r = rs[i];
            var v = new Node(vars[i], r, rect.getCentre(r));
            events[i] = new Event(true, v, rect.getOpen(r));
            events[i + n] = new Event(false, v, rect.getClose(r));
        }
        events.sort(compareEvents);
        var cs = new Array<Constraint>();
        var scanline = makeRBTree();
        for (i = 0; i < N; ++i) {
            var e = events[i];
            var v = e.v;
            if (e.isOpen) {
                scanline.insert(v);
                rect.findNeighbours(v, scanline);
            } else {
                // close event
                scanline.remove(v);
                var makeConstraint = (l, r) => {
                    var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
                    cs.push(new Constraint(l.v, r.v, sep));
                };
                var visitNeighbours = (forward, reverse, mkcon) => {
                    var u, it = v[forward].iterator();
                    while ((u = it[forward]()) !== null) {
                        mkcon(u, v);
                        u[reverse].remove(v);
                    }
                };
                visitNeighbours("prev", "next", (u, v) => makeConstraint(u, v));
                visitNeighbours("next", "prev", (u, v) => makeConstraint(v, u));
            }
        }
        console.assert(scanline.size === 0);
        return cs;
    }

    function findXNeighbours(v: Node, scanline: RBTree<Node>): void {
        var f = (forward, reverse) => {
            var it = scanline.findIter(v);
            var u;
            while ((u = it[forward]()) !== null) {
                var uovervX = u.r.overlapX(v.r);
                if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
                if (uovervX <= 0) {
                    break;
                }
            }
        }
        f("next", "prev");
        f("prev", "next");
    }

    function findYNeighbours(v: Node, scanline: RBTree<Node>): void {
        var f = (forward, reverse) => {
            var u = scanline.findIter(v)[forward]();
            if (u !== null && u.r.overlapX(v.r) > 0) {
                v[forward].insert(u);
                u[reverse].insert(v);
            }
        }
        f("next", "prev");
        f("prev", "next");
    }

    export function generateXConstraints(rs: Rectangle[], vars: Variable[]): Constraint[] {
        return generateConstraints(rs, vars, xRect, 1e-6);
    }

    export function generateYConstraints(rs: Rectangle[], vars: Variable[]): Constraint[] {
        return generateConstraints(rs, vars, yRect, 1e-6);
    }

    export function generateXGroupConstraints(root: Group): Constraint[] {
        return generateGroupConstraints(root, xRect, 1e-6);
    }

    export function generateYGroupConstraints(root: Group): Constraint[] {
        return generateGroupConstraints(root, yRect, 1e-6);
    }

    export function removeOverlaps(rs: Rectangle[]): void {
        var vs = rs.map(r => new vpsc.Variable(r.cx()));
        var cs = vpsc.generateXConstraints(rs, vs);
        var solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setXCentre(v.position()));
        vs = rs.map(function (r) {
            return new vpsc.Variable(r.cy());
        });
        cs = vpsc.generateYConstraints(rs, vs);
        solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setYCentre(v.position()));
    }
}