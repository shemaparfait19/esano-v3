import {
  FamilyMember,
  FamilyEdge,
  NodePosition,
  EdgePath,
  LayoutResult,
} from "@/types/family-tree";

interface LayoutNode {
  id: string;
  member: FamilyMember;
  level: number;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  parents: LayoutNode[];
  spouses: LayoutNode[];
}

interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  levelSpacing: number;
  siblingSpacing: number;
  coupleSpacing: number;
  margin: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 120,
  nodeHeight: 80,
  levelSpacing: 150,
  siblingSpacing: 140,
  coupleSpacing: 20,
  margin: 50,
};

export class ClassicLayoutEngine {
  private config: LayoutConfig;
  private nodes: Map<string, LayoutNode> = new Map();
  private levels: Map<number, LayoutNode[]> = new Map();

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  layout(members: FamilyMember[], edges: FamilyEdge[]): LayoutResult {
    this.nodes.clear();
    this.levels.clear();

    // Build graph structure
    this.buildGraph(members, edges);

    // Calculate levels (generations)
    this.calculateLevels();

    // Position nodes within levels
    this.positionNodes();

    // Apply rule-based refinements for traditional genealogy layout
    this.arrangeChildrenUnderParents(edges);
    this.arrangeParentsAboveChildren(edges);

    // Generate edge paths
    const edgePaths = this.generateEdgePaths(edges);

    // Calculate bounds
    const bounds = this.calculateBounds();

    return {
      nodes: Array.from(this.nodes.values()).map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        level: node.level,
      })),
      edges: edgePaths,
      bounds,
    };
  }

  private buildGraph(members: FamilyMember[], edges: FamilyEdge[]): void {
    // Create layout nodes
    members.forEach((member) => {
      this.nodes.set(member.id, {
        id: member.id,
        member,
        level: 0,
        x: 0,
        y: 0,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        children: [],
        parents: [],
        spouses: [],
      });
    });

    // Build relationships
    edges.forEach((edge) => {
      const fromNode = this.nodes.get(edge.fromId);
      const toNode = this.nodes.get(edge.toId);

      if (!fromNode || !toNode) return;

      switch (edge.type) {
        case "parent":
          fromNode.children.push(toNode);
          toNode.parents.push(fromNode);
          break;
        case "spouse":
          fromNode.spouses.push(toNode);
          toNode.spouses.push(fromNode);
          break;
        case "adoptive":
        case "step":
          fromNode.children.push(toNode);
          toNode.parents.push(fromNode);
          break;
      }
    });
  }

  private calculateLevels(): void {
    // Find root nodes (nodes with no parents)
    const rootNodes = Array.from(this.nodes.values()).filter(
      (node) => node.parents.length === 0
    );

    // Choose deterministic anchor: earliest birthDate, then highest out-degree, then id
    const pickAnchor = (nodes: LayoutNode[]): LayoutNode => {
      const score = (n: LayoutNode) => {
        const bd = n.member.birthDate
          ? Date.parse(n.member.birthDate)
          : Number.MAX_SAFE_INTEGER;
        const out = n.children.length;
        return { bd, out, id: n.id };
      };
      return nodes.slice().sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        if (sa.bd !== sb.bd) return sa.bd - sb.bd;
        if (sb.out !== sa.out) return sb.out - sa.out;
        return sa.id.localeCompare(sb.id);
      })[0];
    };

    const anchors: LayoutNode[] = [];
    if (rootNodes.length > 0) {
      anchors.push(pickAnchor(rootNodes));
    } else {
      // If no clear roots, use node with most children as anchor (deterministic tie-breaker by id)
      anchors.push(
        Array.from(this.nodes.values())
          .slice()
          .sort(
            (a, b) =>
              b.children.length - a.children.length || a.id.localeCompare(b.id)
          )[0]
      );
    }

    // BFS to assign levels from chosen anchors
    const visited = new Set<string>();
    const queue: { node: LayoutNode; level: number }[] = anchors.map(
      (node) => ({ node, level: 0 })
    );

    while (queue.length > 0) {
      const { node, level } = queue.shift()!;

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      node.level = level;

      // Add to level group
      if (!this.levels.has(level)) {
        this.levels.set(level, []);
      }
      this.levels.get(level)!.push(node);

      // Add children to queue (one level down)
      node.children.forEach((child) => {
        if (!visited.has(child.id)) {
          queue.push({ node: child, level: level + 1 });
        }
      });
    }

    // Handle unvisited nodes (orphans or disconnected)
    Array.from(this.nodes.values()).forEach((node) => {
      if (!visited.has(node.id)) {
        node.level = this.levels.size;
        if (!this.levels.has(node.level)) {
          this.levels.set(node.level, []);
        }
        this.levels.get(node.level)!.push(node);
      }
    });
  }

  private positionNodes(): void {
    const maxLevel = Math.max(...Array.from(this.levels.keys()));

    // Position each level
    for (let level = 0; level <= maxLevel; level++) {
      const levelNodes = this.levels.get(level) || [];
      this.positionLevel(levelNodes, level);
    }
  }

  private positionLevel(levelNodes: LayoutNode[], level: number): void {
    if (levelNodes.length === 0) return;

    // Group couples together
    const couples = this.groupCouples(levelNodes);
    const positionedNodes: LayoutNode[] = [];

    couples.forEach((couple) => {
      if (couple.length === 2) {
        // Position couple side by side
        let [spouse1, spouse2] = couple;
        // Heuristic ordering: keep male on the left if genders are known
        if (
          (spouse1.member.gender === "female" &&
            spouse2.member.gender === "male") ||
          (spouse1.member.gender === "other" &&
            spouse2.member.gender === "male")
        ) {
          [spouse1, spouse2] = [spouse2, spouse1];
        }
        const totalWidth =
          this.config.nodeWidth * 2 + this.config.coupleSpacing;
        const startX = this.calculateLevelStartX(levelNodes.length, totalWidth);

        spouse1.x = startX;
        spouse1.y = level * this.config.levelSpacing + this.config.margin;

        spouse2.x = startX + this.config.nodeWidth + this.config.coupleSpacing;
        spouse2.y = level * this.config.levelSpacing + this.config.margin;

        positionedNodes.push(spouse1, spouse2);
      } else {
        // Single node
        const node = couple[0];
        const startX = this.calculateLevelStartX(
          levelNodes.length,
          this.config.nodeWidth
        );

        node.x = startX;
        node.y = level * this.config.levelSpacing + this.config.margin;

        positionedNodes.push(node);
      }
    });

    // Adjust positions to center the level
    this.centerLevel(levelNodes);
  }

  // Arrange siblings under their parents based on rules (birthDate/name) and center under parents
  private arrangeChildrenUnderParents(edges: FamilyEdge[]): void {
    const childToParents = new Map<string, LayoutNode[]>();
    edges.forEach((edge) => {
      if (edge.type !== "parent") return;
      const parent = this.nodes.get(edge.fromId);
      const child = this.nodes.get(edge.toId);
      if (!parent || !child) return;
      const arr = childToParents.get(child.id) || [];
      arr.push(parent);
      childToParents.set(child.id, arr);
    });

    const groupKeyToChildren = new Map<string, LayoutNode[]>();
    const groupKeyToParents = new Map<string, LayoutNode[]>();
    childToParents.forEach((parents, childId) => {
      const key = parents
        .map((p) => p.id)
        .sort()
        .join("|");
      const child = this.nodes.get(childId);
      if (!child) return;
      const list = groupKeyToChildren.get(key) || [];
      list.push(child);
      groupKeyToChildren.set(key, list);
      groupKeyToParents.set(key, parents);
    });

    groupKeyToChildren.forEach((children, key) => {
      const parents = groupKeyToParents.get(key) || [];
      if (parents.length === 0) return;
      const centerX =
        parents.reduce((sum, p) => sum + (p.x + p.width / 2), 0) /
        parents.length;
      const baseY = Math.max(...children.map((c) => c.y));

      const sortedChildren = [...children].sort((a, b) => {
        const aDate = a.member.birthDate
          ? Date.parse(a.member.birthDate)
          : Number.MAX_SAFE_INTEGER;
        const bDate = b.member.birthDate
          ? Date.parse(b.member.birthDate)
          : Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
        return (a.member.fullName || "").localeCompare(b.member.fullName || "");
      });

      const spacing = Math.max(40, this.config.siblingSpacing / 2);
      const totalWidth =
        sortedChildren.length * this.config.nodeWidth +
        (sortedChildren.length - 1) * spacing;
      let startX = centerX - totalWidth / 2;
      sortedChildren.forEach((childNode) => {
        childNode.x = startX;
        childNode.y = baseY;
        startX += this.config.nodeWidth + spacing;
      });
    });
  }

  // Center parents (or parent couples) above the horizontal span of their children
  private arrangeParentsAboveChildren(edges: FamilyEdge[]): void {
    // Build parent groups keyed by sorted parent ids (single or couple)
    const parentGroupToParents = new Map<string, LayoutNode[]>();
    const parentGroupToChildren = new Map<string, LayoutNode[]>();

    // For each parent edge, associate parent with child; then group by spouse-pair when available
    const childIdToParents: Record<string, LayoutNode[]> = {} as any;
    edges.forEach((edge) => {
      if (edge.type !== "parent") return;
      const parent = this.nodes.get(edge.fromId);
      const child = this.nodes.get(edge.toId);
      if (!parent || !child) return;
      (childIdToParents[child.id] ||= []).push(parent);
    });

    Object.entries(childIdToParents).forEach(([childId, parents]) => {
      // Determine group key: if two parents who are spouses, pair them; else single parent
      let groupParents: LayoutNode[] = parents;
      if (parents.length >= 2) {
        // If any two are spouses, pick that pair.
        const pA = parents[0];
        const spouse = parents.find((p) =>
          pA.spouses.some((s) => s.id === p.id)
        );
        if (spouse) groupParents = [pA, spouse];
        else groupParents = [parents[0]]; // fallback: single anchor
      }
      const key = groupParents
        .map((p) => p.id)
        .sort()
        .join("|");
      parentGroupToParents.set(key, groupParents);
      const childNode = this.nodes.get(childId);
      if (!childNode) return;
      const list = parentGroupToChildren.get(key) || [];
      list.push(childNode);
      parentGroupToChildren.set(key, list);
    });

    parentGroupToChildren.forEach((children, key) => {
      const parents = parentGroupToParents.get(key) || [];
      if (parents.length === 0 || children.length === 0) return;

      // Compute children's horizontal center
      const centerX =
        children.reduce((sum, c) => sum + (c.x + c.width / 2), 0) /
        children.length;

      if (parents.length === 1) {
        const p = parents[0];
        p.x = centerX - p.width / 2;
        return;
      }

      // Two-parent couple: honor spouse ordering, center the pair above
      let [left, right] = parents;
      if (
        (left.member.gender === "female" && right.member.gender === "male") ||
        (left.member.gender === "other" && right.member.gender === "male")
      ) {
        [left, right] = [right, left];
      }

      const totalWidth = this.config.nodeWidth * 2 + this.config.coupleSpacing;
      const startX = centerX - totalWidth / 2;
      left.x = startX;
      right.x = startX + this.config.nodeWidth + this.config.coupleSpacing;
    });
  }

  private groupCouples(nodes: LayoutNode[]): LayoutNode[][] {
    const couples: LayoutNode[][] = [];
    const processed = new Set<string>();

    nodes.forEach((node) => {
      if (processed.has(node.id)) return;

      const couple = [node];
      processed.add(node.id);

      // Find spouse
      const spouse = node.spouses.find((s) => !processed.has(s.id));
      if (spouse) {
        couple.push(spouse);
        processed.add(spouse.id);
      }

      couples.push(couple);
    });

    return couples;
  }

  private calculateLevelStartX(nodeCount: number, nodeWidth: number): number {
    const totalWidth =
      nodeCount * nodeWidth + (nodeCount - 1) * this.config.siblingSpacing;
    return -totalWidth / 2;
  }

  private centerLevel(levelNodes: LayoutNode[]): void {
    if (levelNodes.length === 0) return;

    const minX = Math.min(...levelNodes.map((n) => n.x));
    const maxX = Math.max(...levelNodes.map((n) => n.x + n.width));
    const centerOffset = -(minX + maxX) / 2;

    levelNodes.forEach((node) => {
      node.x += centerOffset;
    });
  }

  private generateEdgePaths(edges: FamilyEdge[]): EdgePath[] {
    return edges.map((edge) => {
      const fromNode = this.nodes.get(edge.fromId);
      const toNode = this.nodes.get(edge.toId);

      if (!fromNode || !toNode) {
        return {
          id: edge.id,
          fromId: edge.fromId,
          toId: edge.toId,
          path: "",
          type: edge.type,
        };
      }

      const path = this.createEdgePath(fromNode, toNode, edge.type);

      return {
        id: edge.id,
        fromId: edge.fromId,
        toId: edge.toId,
        path,
        type: edge.type,
      };
    });
  }

  private createEdgePath(
    fromNode: LayoutNode,
    toNode: LayoutNode,
    type: FamilyEdge["type"]
  ): string {
    const fromX = fromNode.x + fromNode.width / 2;
    const fromY = fromNode.y + fromNode.height / 2;
    const toX = toNode.x + toNode.width / 2;
    const toY = toNode.y + toNode.height / 2;

    if (type === "spouse") {
      // Horizontal line for spouses
      return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    } else {
      // Curved line for parent-child relationships
      const midY = (fromY + toY) / 2;
      const controlY1 = fromY + (midY - fromY) * 0.5;
      const controlY2 = toY - (toY - midY) * 0.5;

      return `M ${fromX} ${fromY} C ${fromX} ${controlY1} ${toX} ${controlY2} ${toX} ${toY}`;
    }
  }

  private calculateBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    const nodes = Array.from(this.nodes.values());
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const minX = Math.min(...nodes.map((n) => n.x)) - this.config.margin;
    const maxX =
      Math.max(...nodes.map((n) => n.x + n.width)) + this.config.margin;
    const minY = Math.min(...nodes.map((n) => n.y)) - this.config.margin;
    const maxY =
      Math.max(...nodes.map((n) => n.y + n.height)) + this.config.margin;

    return { minX, minY, maxX, maxY };
  }
}
