# Lost Family Search - Implementation Plan

## Overview

A live search feature that helps users find lost family members by allowing them to search with any information they remember - names, locations, or other details.

## Database Structure & Search Strategy

### Primary Search Sources

1. **User Profiles Collection** (`users`)

   - Fields: `fullName`, `firstName`, `lastName`, `email`, `phone`
   - Personal info: `birthDate`, `birthPlace`, `currentCity`, `hometown`
   - Extended fields: `education`, `work`, `residence`, `legacy` fields

2. **Family Tree Members Collection** (`familyTreeMembers`)

   - Aggregate from all users' family trees
   - Fields: `fullName`, `birthDate`, `deathDate`, `birthPlace`, `notes`
   - Relationship context: `treeOwnerId`, `addedBy`

3. **Connection Requests/History** (`connections`)
   - Track previous search attempts and connections
   - Help surface relevant matches

### Search Index Strategy

```javascript
// Firestore composite indexes needed:
// users: [fullName, currentCity, birthPlace]
// users: [firstName, lastName, birthDate]
// familyTreeMembers: [fullName, birthPlace, treeOwnerId]
// Example locations: Kigali, Musanze, Huye, Rubavu, Nyagatare, Muhanga
```

### Search Algorithm Design

#### 1. Query Parsing

- Extract potential names (first/last name combinations)
- Identify location keywords (cities, states, countries)
- Detect dates/years
- Capture other contextual information

#### 2. Multi-Field Matching Strategy

```javascript
const searchStrategy = {
  exact_name_match: { weight: 100, boost: true },
  partial_name_match: { weight: 80 },
  location_match: { weight: 60 },
  date_proximity: { weight: 40 },
  contextual_info: { weight: 20 },
};
```

#### 3. Result Ranking Algorithm

- **Primary**: Exact name matches
- **Secondary**: Partial name + location matches
- **Tertiary**: Family tree context (shared relatives)
- **Quaternary**: Profile completeness and recency

## API Endpoints Design

### `/api/search/family` (GET)

```typescript
interface SearchRequest {
  query: string;
  limit?: number; // default 20
  offset?: number; // for pagination
}

interface SearchResult {
  id: string;
  type: "user" | "family_member";
  name: string;
  matchScore: number;
  matchReasons: string[];
  preview: {
    location?: string;
    birthDate?: string;
    relationshipContext?: string;
    profilePicture?: string;
  };
  contactInfo?: {
    canConnect: boolean;
    connectionStatus?: "none" | "pending" | "connected";
  };
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  suggestions?: string[]; // search refinement suggestions
}
```

## Frontend Implementation

### Component Structure

```
/dashboard/search/
├── page.tsx                 # Main search page
├── components/
│   ├── search-input.tsx     # Live search input with debouncing
│   ├── search-results.tsx   # Results container
│   ├── result-card.tsx      # Individual result card
│   └── search-filters.tsx   # Optional filters (location, age range)
```

### Live Search Implementation

```typescript
// Key features:
const useSearchFeatures = {
  debouncing: "300ms delay",
  caching: "Cache recent searches",
  loading_states: "Skeleton cards while searching",
  error_handling: "Graceful fallbacks",
  infinite_scroll: "Load more results on scroll",
};
```

### Result Card Design

```typescript
interface ResultCardProps {
  result: SearchResult;
  onConnect: (userId: string) => void;
  onViewProfile: (userId: string) => void;
}

// Card includes:
// - Name (prominent)
// - Match confidence indicator
// - Key matching details
// - Location/birth info
// - Connection action buttons
// - "Why this match?" explanation
```

## Performance Optimization Strategy

### 1. Search Performance

- **Debounced input**: 300ms delay to reduce API calls
- **Query caching**: Cache results for identical searches
- **Incremental loading**: Load 20 results initially, infinite scroll for more
- **Search indexing**: Firestore composite indexes for fast queries

### 2. Database Optimization

```javascript
// Firestore query optimization:
const optimizedQuery = {
  use_composite_indexes: true,
  limit_results: 20,
  cache_frequent_searches: true,
  batch_multiple_collections: true,
};
```

### 3. Frontend Performance

- **Virtual scrolling** for large result sets
- **Image lazy loading** for profile pictures
- **Skeleton loading** states
- **Request cancellation** for outdated searches

## Security & Privacy Considerations

### 1. Search Permissions

- Users can only search public profiles or profiles they're connected to
- Family tree members are searchable only if tree owner allows it
- Respect user privacy settings

### 2. Rate Limiting

- Max 100 searches per user per hour
- Prevent abuse and spam searches

### 3. Data Protection

- Don't expose sensitive information in search results
- Log searches for analytics but anonymize personal data

## User Experience Flow

### 1. Search Input Experience

```
User types: "Uwimana Musanze"
↓
System parses: name="Uwimana", location="Musanze"
↓
Live results appear showing:
- Marie Uwimana (Musanze, Northern Province) - 95% match
- Jean Uwimana (Kigali City) - 85% match
- Claudine Uwimana (Ruhango, Southern Province) - 80% match
```

### 2. Result Interaction

```
User sees result card:
┌─────────────────────────────────┐
│ 👤 Marie Uwimana                │
│ 📍 Musanze, Northern Province   │
│ 🎯 95% match • Born 1987        │
│ ✓ Name + Location match         │
│                                 │
│ [View Profile] [Send Request]   │
└─────────────────────────────────┘
```

### 3. Connection Flow

- Click "Send Request" → Connection request sent
- Click "View Profile" → Navigate to profile page
- Show connection status if already connected

## Implementation Phases

### Phase 1: Core Search (Week 1)

- [x] Create implementation plan
- [ ] Set up search API endpoint
- [ ] Implement basic name-based search
- [ ] Create search input component with debouncing
- [ ] Build result cards with basic info

### Phase 2: Enhanced Matching (Week 2)

- [ ] Add location-based matching
- [ ] Implement search result ranking
- [ ] Add family tree member searching
- [ ] Create "match confidence" scoring

### Phase 3: UX Polish (Week 3)

- [ ] Add infinite scroll pagination
- [ ] Implement search result caching
- [ ] Add search filters (location, age range)
- [ ] Create search suggestions/autocomplete

### Phase 4: Advanced Features (Week 4)

- [ ] Add AI-powered search suggestions
- [ ] Implement search analytics
- [ ] Add "similar profiles" recommendations
- [ ] Create search history for users

## Success Metrics

- **Search Speed**: Results appear within 500ms
- **Search Accuracy**: 80%+ of searches return relevant results
- **User Engagement**: 60%+ of searches lead to profile views or connection requests
- **Performance**: Handle 1000+ concurrent searches without degradation

## Technical Dependencies

- Firestore composite indexes (requires deployment)
- Search result caching (Redis or in-memory)
- Image optimization for profile pictures
- Real-time connection status updates

## Risk Mitigation

1. **Slow search performance**: Implement aggressive caching and indexing
2. **Poor search results**: A/B test different ranking algorithms
3. **Privacy concerns**: Strict permission checks and user controls
4. **Spam/abuse**: Rate limiting and user reporting system

---

## Next Steps

1. Review and approve this implementation plan
2. Set up required Firestore indexes
3. Begin Phase 1 implementation with core search functionality
4. Test search performance with sample data
5. Iterate based on user feedback

**Ready to proceed with implementation once plan is approved.**
