const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const NODES = [];
const LINKS = [];

// Node represents BOTH our Balls and our hidden joints
class Node {
    constructor(x, y, r, isAnchor, color) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.r = r;
        this.isAnchor = isAnchor; // If true, it drives the movement
        this.color = color;
        
        // Curve movement variables
        this.target_x = x;
        this.target_y = y;
        this.velo_x = 0;
        this.moving = false;
        this.curve = null;
        
        NODES.push(this);
    }

    applyPhysics() {
        if (this.isAnchor) return; // The active anchor ignores gravity

        let vx = (this.x - this.oldX) * 0.98; // Air friction
        let vy = (this.y - this.oldY) * 0.98;

        this.oldX = this.x;
        this.oldY = this.y;
        
        this.x += vx;
        this.y += vy + 0.5; // Gravity
    }

    updateKinematic() {
        if (!this.moving || !this.isAnchor) return;

        const distanceToTargetX = Math.abs(this.target_x - this.x);

        if (distanceToTargetX <= Math.abs(this.velo_x)) {
            this.x = this.target_x;
            this.y = this.target_y;
            this.moving = false;
            
            // Clear momentum so it doesn't fly away if it becomes a physics object later
            this.oldX = this.x;
            this.oldY = this.y; 
        } else {
            // Keep track of old position to inherit momentum if clicked mid-air
            this.oldX = this.x;
            this.oldY = this.y;
            
            this.x += this.velo_x;
            this.y = Math.pow(this.x - this.curve.h, 2) * this.curve.a + this.curve.k;
        }
    }

    draw() {
        if (this.r <= 0) return; // Don't draw invisible joints
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.strokeStyle = "black";
        ctx.stroke();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Link represents the rigid tails connecting the nodes
class Link {
    constructor(nodeA, nodeB, length, height) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.length = length;
        this.height = height;
        
        LINKS.push(this);
    }

    solveConstraint() {
        const dx = this.nodeB.x - this.nodeA.x;
        const dy = this.nodeB.y - this.nodeA.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > 0) {
            const difference = this.length - distance;
            const percent = difference / distance;
            
            const offsetX = dx * percent * 0.5;
            const offsetY = dy * percent * 0.5;
            
            // If neither is an anchor, they both move 50% towards each other.
            // If one is an anchor, the other moves 100% to catch up.
            if (!this.nodeA.isAnchor) {
                this.nodeA.x -= offsetX * (this.nodeB.isAnchor ? 2 : 1);
                this.nodeA.y -= offsetY * (this.nodeB.isAnchor ? 2 : 1);
            }
            if (!this.nodeB.isAnchor) {
                this.nodeB.x += offsetX * (this.nodeA.isAnchor ? 2 : 1);
                this.nodeB.y += offsetY * (this.nodeA.isAnchor ? 2 : 1);
            }
        }
    }

    draw() {
        const dx = this.nodeB.x - this.nodeA.x;
        const dy = this.nodeB.y - this.nodeA.y;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(this.nodeA.x, this.nodeA.y);
        ctx.rotate(angle);
        
        ctx.fillStyle = "blue";
        ctx.fillRect(0, -this.height / 2, this.length, this.height);
        
        // Draw the white hinge dot
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(this.length, 0, 3, 0, 2*Math.PI);
        ctx.fill();
        
        ctx.restore();
    }
}

class Curve {
    constructor(a, h, k) {
        this.a = a;
        this.h = h;
        this.k = k;
    }
}

function calculateCurve(start_x, start_y, final_x, final_y) {
    const p = 50;
    let k = Math.min(start_y, final_y) - p; 
    
    let r = Math.sqrt((k - start_y) / (k - final_y));
    let h = (r * final_x + start_x) / (1 + r);
    let a = (start_y - k) / (Math.pow(start_x - h, 2));
    
    return new Curve(a, h, k);
}

// --- INITIALIZATION ---
// Node 0: First Ball (Red)
// Node 1: Invisible Hinge
// Node 2: Second Ball (Green)
let activeAnchorIndex = 0; 

let ball1 = new Node(100, 400, 20, true, "red");  // Starts as Anchor
let joint1 = new Node(100, 460, 0, false, "black"); // Hidden joint
let ball2 = new Node(100, 520, 20, false, "green"); // Starts as Physics

let link1 = new Link(ball1, joint1, 60, 15);
let link2 = new Link(joint1, ball2, 60, 15);

canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    let targetX = e.clientX - rect.left;
    let targetY = e.clientY - rect.top;

    // 1. Release the current anchor to gravity
    let oldAnchor = NODES[activeAnchorIndex];
    oldAnchor.isAnchor = false;
    oldAnchor.moving = false;

    // 2. Swap the active anchor index (0 becomes 2, 2 becomes 0)
    activeAnchorIndex = (activeAnchorIndex === 0) ? 2 : 0;
    
    // 3. Setup the new anchor for its curve jump
    let newAnchor = NODES[activeAnchorIndex];
    newAnchor.isAnchor = true;

    newAnchor.target_x = targetX;
    newAnchor.target_y = targetY;

    if (newAnchor.target_x === newAnchor.x) {
        newAnchor.target_x += 1; 
    }

    const dx = newAnchor.target_x - newAnchor.x;
    const dy = newAnchor.target_y - newAnchor.y;
    const totalDistance = Math.hypot(dx, dy);
    
    const desiredOverallSpeed = 10;
    const framesToArrival = totalDistance / desiredOverallSpeed;

    newAnchor.velo_x = dx / framesToArrival;
    newAnchor.curve = calculateCurve(newAnchor.x, newAnchor.y, newAnchor.target_x, newAnchor.target_y);
    newAnchor.moving = true;
});


function mainLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // 1. Apply Physics (Gravity & Momentum) to free nodes
    NODES.forEach((n) => n.applyPhysics());

    // 2. Apply Kinematic movement to the active anchor
    NODES.forEach((n) => n.updateKinematic());

    // 3. Solve Constraints (Stiffness)
    for (let i = 0; i < 5; i++) {
        LINKS.forEach((link) => link.solveConstraint());
    }

    // 4. Draw Links then Nodes (so balls render on top of tails)
    LINKS.forEach((link) => link.draw());
    NODES.forEach((n) => n.draw());

    requestAnimationFrame(mainLoop);
}

requestAnimationFrame(mainLoop);