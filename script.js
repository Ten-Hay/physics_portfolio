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
    // --- NEW: Added 'visible' parameter to hide structural joints ---
    constructor(nodeA, nodeB, length, height, color = "blue", drawHinge = true, pivotOffset = 0.5, visible = true) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.length = length;
        this.height = height;
        this.color = color;
        this.drawHinge = drawHinge;
        this.pivotOffset = pivotOffset; 
        this.visible = visible;
        
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
        if (!this.visible) return; // Hide invisible structural links!

        const dx = this.nodeB.x - this.nodeA.x;
        const dy = this.nodeB.y - this.nodeA.y;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(this.nodeA.x, this.nodeA.y);
        ctx.rotate(angle);
        
        ctx.fillStyle = this.color;
        
        ctx.fillRect(0, -this.height * this.pivotOffset, this.length, this.height);
        
        if (this.drawHinge) {
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(this.length, 0, 3, 0, 2*Math.PI);
            ctx.fill();
        }
        
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
    // 1. Find both the vertical and horizontal distances
    const dy = Math.abs(start_y - final_y);
    const dx = Math.abs(start_x - final_x);

    // 2. Set up our minimum and maximum peak heights
    // I lowered the minimum a bit so tiny hops look more natural!
    const min_peak = 15;  
    const max_peak = 200;

    // 3. Vertical Factor (closer Y = higher peak)
    const max_expected_dy = 600; 
    const v_factor = Math.max(0, max_expected_dy - dy) / max_expected_dy;
    
    // 4. NEW: Horizontal Factor (shorter X = shorter peak)
    // Assume 300px is a "full" horizontal jump. 
    // If dx is 150px, h_factor is 0.5. If dx is 600px, it caps at 1.
    const expected_dx = 300;
    const h_factor = Math.min(1, dx / expected_dx); 

    // Combine both factors!
    let base_p = min_peak + ((max_peak - min_peak) * v_factor * h_factor);

    // 5. Add randomness (+/- 20 pixels)
    const random_jitter = (Math.random() - 0.5) * 40; 
    
    // Apply the jitter and ensure the peak never drops below our minimum
    let p = base_p + random_jitter;
    p = Math.max(min_peak, p);

    // --- Original Curve Math ---
    let k = Math.min(start_y, final_y) - p; 
    
    let r = Math.sqrt((k - start_y) / (k - final_y));
    let h = (r * final_x + start_x) / (1 + r);
    let a = (start_y - k) / (Math.pow(start_x - h, 2));
    
    return new Curve(a, h, k);
}

// --- FULL BODY INITIALIZATION ---

let startX = 300; 
let y = 300;

// --- ADJUSTABLE VARIABLES ---
let torsoLength = 100; 
let torsoWidth = 55;   
let headHeight = 45; // How high above the shoulders the center of the head sits

let torsoVisualHeight = torsoLength / 0.8; 

// Nodes 0 to 5: The Upper Body
let handL = new Node(startX - 100, y, 15, true, "red");         // Node 0
let elbowL = new Node(startX - 50, y, 0, false, "black");       // Node 1
let shoulderL = new Node(startX, y, 0, false, "black");         // Node 2 
let shoulderR = new Node(startX + torsoWidth, y, 0, false, "black");    // Node 3
let elbowR = new Node(startX + torsoWidth + 50, y, 0, false, "black");  // Node 4
let handR = new Node(startX + torsoWidth + 100, y, 15, false, "green"); // Node 5

// Nodes: The Lower Body
let hipL = new Node(startX, y + torsoLength, 0, false, "black");        
let hipR = new Node(startX + torsoWidth, y + torsoLength, 0, false, "black");   
let kneeL = new Node(startX, y + torsoLength + 60, 0, false, "black");       
let kneeR = new Node(startX + torsoWidth, y + torsoLength + 60, 0, false, "black");  
let footL = new Node(startX, y + torsoLength + 120, 0, false, "black");       
let footR = new Node(startX + torsoWidth, y + torsoLength + 120, 0, false, "black");  

// --- NEW Node: The Head ---
// Placed dead center between the shoulders, and raised up.
// Added to the end of the node list so we don't mess up our Left Hand / Right Hand index logic!
let head = new Node(startX + torsoWidth / 2, y - headHeight, 25, false, "orange"); 


// Links: Arms & Visible Torso
new Link(handL, elbowL, 50, 15, "blue", true);        
new Link(elbowL, shoulderL, 50, 15, "blue", true);    
new Link(shoulderL, shoulderR, torsoWidth, torsoVisualHeight, "purple", false, 0.2); 
new Link(shoulderR, elbowR, 50, 15, "blue", true);    
new Link(elbowR, handR, 50, 15, "blue", true);        

// Links: Invisible Torso Structural Box
new Link(shoulderL, hipL, torsoLength, 0, "transparent", false, 0.5, false); 
new Link(shoulderR, hipR, torsoLength, 0, "transparent", false, 0.5, false); 
new Link(hipL, hipR, torsoWidth, 0, "transparent", false, 0.5, false);       
new Link(shoulderL, hipR, Math.hypot(torsoWidth, torsoLength), 0, "transparent", false, 0.5, false); 
new Link(shoulderR, hipL, Math.hypot(torsoWidth, torsoLength), 0, "transparent", false, 0.5, false); 

// --- NEW Links: Rigid Head Structure (Triangulation) ---
// By linking the head to BOTH shoulders, it becomes completely stiff!
let headDistToShoulder = Math.hypot(torsoWidth / 2, headHeight);
new Link(shoulderL, head, headDistToShoulder, 0, "transparent", false, 0.5, false); // Left neck support
new Link(shoulderR, head, headDistToShoulder, 0, "transparent", false, 0.5, false); // Right neck support

// Links: The Legs
new Link(hipL, kneeL, 60, 15, "blue", true);  
new Link(kneeL, footL, 60, 15, "blue", true); 
new Link(hipR, kneeR, 60, 15, "blue", true);  
new Link(kneeR, footR, 60, 15, "blue", true); 


// --- LOCKED ANCHOR LOGIC ---
const HAND_L_INDEX = 0;
const HAND_R_INDEX = 5;
let activeAnchorIndex = HAND_L_INDEX;

canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    let targetX = e.clientX - rect.left;
    let targetY = e.clientY - rect.top;

    // 1. Release the current anchor
    let oldAnchor = NODES[activeAnchorIndex];
    oldAnchor.isAnchor = false;
    oldAnchor.moving = false;

    // Swap ONLY between the Left Hand (0) and Right Hand (5)
    activeAnchorIndex = (activeAnchorIndex === HAND_L_INDEX) ? HAND_R_INDEX : HAND_L_INDEX;
    
    // 2. Setup the new anchor
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
    
    const desiredOverallSpeed = 9;
    const framesToArrival = totalDistance / desiredOverallSpeed;

    newAnchor.velo_x = dx / framesToArrival;
    newAnchor.curve = calculateCurve(newAnchor.x, newAnchor.y, newAnchor.target_x, newAnchor.target_y);
    newAnchor.moving = true;
});


function mainLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // 1. Apply Physics
    NODES.forEach((n) => n.applyPhysics());

    // 2. Apply Kinematic movement
    NODES.forEach((n) => n.updateKinematic());

    // 3. Solve Constraints
    for (let i = 0; i < 10; i++) {
        LINKS.forEach((link) => link.solveConstraint());
    }

    // 4. Draw Links then Nodes
    LINKS.forEach((link) => link.draw());
    NODES.forEach((n) => n.draw());

    requestAnimationFrame(mainLoop);
}

requestAnimationFrame(mainLoop);