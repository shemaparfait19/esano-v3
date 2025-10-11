# 🌳 Esano: AI Genealogy Explorer

**Esano** is a comprehensive genealogy platform that combines DNA analysis, family tree management, and AI-powered insights to help users discover their heritage and connect with relatives.

## 🎯 Overview

Esano is a full-stack web application that allows users to:

- Upload and analyze raw DNA data using AI
- Build and manage interactive family trees
- Connect with potential relatives
- Discover ancestry and genetic insights
- Search for lost family members
- Collaborate on shared family trees

## 🏗️ Architecture

### **Tech Stack**

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: ShadCN/UI with Lucide React icons
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI Integration**: Google Gemini API, OpenRouter, DeepSeek
- **State Management**: React Context, Zustand
- **Charts**: Recharts
- **Fonts**: Playfair Display (headlines), PT Sans (body)

### **Design System**

- **Primary Color**: Forest Green (#3B823B) - represents growth and ancestry
- **Background**: Light Sage (#F0F5F0) - calm and inviting
- **Accent**: Gold (#D4AF37) - highlights and heritage value

## 📊 Database Schema

### **Core Collections**

#### **Users** (`users`)

```typescript
{
  userId: string;
  email: string;
  displayName: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  location: string;
  profilePicture: string;
  dnaData: string;
  dnaFileName: string;
  analysis: {
    relatives: AnalyzeDnaAndPredictRelativesOutput;
    ancestry: AncestryEstimationOutput;
    insights: GenerationalInsightsOutput;
    completedAt: string;
  }
  createdAt: string;
  updatedAt: string;
}
```

#### **Family Trees** (`familyTrees/{ownerId}`)

```typescript
{
  id: string;
  ownerId: string;
  members: FamilyTreeMember[];
  edges: FamilyTreeEdge[];
  settings: {
    colorScheme: string;
    viewMode: string;
    layout: 'horizontal' | 'vertical' | 'radial' | 'timeline';
  };
  annotations: Annotation[];
  version: {
    current: number;
    history: VersionHistory[];
  };
  createdAt: string;
  updatedAt: string;
}
```

#### **Connection Requests** (`connectionRequests`)

```typescript
{
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
  respondedAt?: string;
}
```

#### **Family Tree Access Requests** (`familyTreeAccessRequests`)

```typescript
{
  ownerId: string;
  requesterId: string;
  access: "viewer" | "editor";
  message: string;
  status: "pending" | "accept" | "deny";
  createdAt: string;
  updatedAt: string;
}
```

#### **Family Tree Shares** (`familyTreeShares`)

```typescript
{
  ownerId: string;
  targetUserId: string;
  targetEmail: string;
  role: "viewer" | "editor";
  createdAt: string;
  updatedAt: string;
}
```

#### **Notifications** (`notifications`)

```typescript
{
  userId: string;
  type: 'tree_shared' | 'tree_access_request' | 'tree_access_accepted' | 'tree_access_denied';
  title: string;
  message: string;
  payload: object;
  status: 'unread' | 'read';
  createdAt: string;
  readAt?: string;
}
```

#### **Messages** (`messages`)

```typescript
{
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}
```

## 🚀 Core Features

### **1. DNA Analysis**

- **Upload**: Secure DNA file upload (23andMe, AncestryDNA, etc.)
- **AI Processing**: Gemini-powered analysis for:
  - Relative matching with confidence scores
  - Ancestry estimation with geographic origins
  - Genetic insights and trait analysis
- **Results**: Interactive charts and detailed reports

### **2. Family Tree Management**

- **Interactive Canvas**: Drag-and-drop family tree builder
- **Hierarchical Layout**: Auto-arranging nodes for large families
- **Real-time Collaboration**: Multiple users can edit simultaneously
- **Sharing System**: Invite others with viewer/editor permissions
- **AI Suggestions**: Relationship suggestions and conflict detection
- **Auto-save**: Debounced saving with progress indicators

### **3. Relative Discovery**

- **DNA Matching**: Find potential relatives based on genetic data
- **Search System**: Search by name, location, or other details
- **Connection Requests**: Send and manage friend requests
- **Profile Viewing**: View other users' public profiles

### **4. Lost Family Search**

- **Multi-field Search**: Search across names, locations, dates
- **Smart Matching**: AI-powered relevance scoring
- **Family Tree Context**: Search within family tree members
- **Connection History**: Track previous search attempts

### **5. AI Assistant**

- **Genealogy Chatbot**: Answer questions about genealogy
- **Context Awareness**: Access to user's family tree data
- **Multi-provider**: Fallback across Gemini, OpenRouter, DeepSeek
- **Specialized Queries**: Family tree analysis and suggestions

### **6. Notifications System**

- **Real-time Updates**: Firestore listeners for instant notifications
- **Bell Icon**: Dashboard header with unread count
- **Categorized**: Connection requests, family tree updates
- **Action Links**: Direct navigation to relevant pages

## 🔧 API Endpoints

### **Authentication**

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

### **DNA Analysis**

- `POST /api/dna/analyze` - Process DNA data
- `GET /api/dna/results` - Get analysis results
- `DELETE /api/dna` - Delete DNA data

### **Family Tree**

- `GET /api/family-tree?userId=` - Load family tree
- `POST /api/family-tree` - Save family tree
- `DELETE /api/family-tree` - Delete family tree
- `POST /api/family-tree/share` - Share tree with user
- `GET /api/family-tree/share` - List shared trees
- `POST /api/family-tree/access-request` - Request tree access
- `PATCH /api/family-tree/access-request` - Accept/deny access
- `GET /api/family-tree/access-request` - List access requests
- `POST /api/family-tree/ai/ask` - AI family tree queries

### **Search**

- `GET /api/search/optimized?query=` - Optimized user search
- `GET /api/search/family?query=` - Family tree search
- `GET /api/search/simple?query=` - Simple search

### **Connections**

- `POST /api/requests` - Send connection request
- `PATCH /api/requests` - Accept/decline connection
- `GET /api/requests` - List connection requests

### **AI Assistant**

- `POST /api/assistant` - Chat with AI assistant

### **Notifications**

- `POST /api/notifications/mark-read` - Mark notification as read
- `POST /api/notifications/mark-read-share` - Mark share notification as read

## 🎨 User Interface

### **Dashboard Layout**

- **Sidebar Navigation**: Dashboard, DNA Analysis, Relatives, Profile, Family Tree, Ancestry, Insights, Assistant
- **Header**: User profile, notifications, messages, search
- **Main Content**: Feature-specific pages

### **Key Pages**

1. **Dashboard** (`/dashboard`) - Overview and feature cards
2. **DNA Analysis** (`/dashboard/dna-analysis`) - Upload and view results
3. **Relatives** (`/dashboard/relatives`) - Connected friends and DNA matches
4. **Profile** (`/dashboard/profile`) - User profile management
5. **Family Tree** (`/dashboard/family-tree`) - Interactive tree builder
6. **Ancestry** (`/dashboard/ancestry`) - Ethnicity and geographic origins
7. **Insights** (`/dashboard/insights`) - Genetic traits and health insights
8. **Assistant** (`/dashboard/assistant`) - AI chatbot interface
9. **Search** (`/dashboard/search`) - Find users and relatives
10. **Messages** (`/dashboard/messages`) - Chat with connections
11. **Notifications** (`/dashboard/notifications`) - Manage all notifications
12. **Shared Trees** (`/dashboard/shared-trees`) - View shared family trees

## 🔐 Security & Privacy

### **Firestore Security Rules**

- User data: Owner-only access
- Family trees: Owner + invited collaborators
- Connection requests: Participants only
- Messages: Sender/receiver only
- Notifications: User-specific

### **Data Protection**

- DNA data encryption
- PII protection in AI contexts
- Privacy flags for family members
- Role-based tree access

## 🚀 Getting Started

### **Prerequisites**

- Node.js 18+
- Firebase project
- Google Gemini API key
- Optional: OpenRouter, DeepSeek API keys

### **Installation**

```bash
# Clone repository
git clone <repository-url>
cd esano-v2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys and Firebase config

# Run development server
npm run dev
```

### **Environment Variables**

```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key
SERVICE_ACCOUNT_JSON=base64-encoded-service-account

# AI APIs
GEMINI_API_KEY=your-gemini-key
OPENROUTER_API_KEY=your-openrouter-key
DEEPSEEK_API_KEY=your-deepseek-key
```

### **Deployment**

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy to Vercel
vercel deploy
```

## 🔄 Workflow

### **New User Journey**

1. **Sign Up** → Create account with email/password
2. **Profile Setup** → Complete profile information
3. **DNA Upload** → Upload raw DNA file
4. **Analysis** → AI processes DNA data
5. **Explore Results** → View relatives, ancestry, insights
6. **Build Family Tree** → Create interactive family tree
7. **Connect** → Send requests to potential relatives
8. **Collaborate** → Share trees and work together

### **Family Tree Workflow**

1. **Create Tree** → Start with yourself as focal person
2. **Add Members** → Add parents, siblings, children
3. **Define Relationships** → Connect family members
4. **Share Tree** → Invite family members to collaborate
5. **AI Suggestions** → Get relationship recommendations
6. **Export/Print** → Save or share family tree

### **Connection Workflow**

1. **Discover** → Find potential relatives through DNA or search
2. **Request** → Send connection request
3. **Accept** → Approve connection request
4. **Message** → Start conversation
5. **Share Trees** → Grant family tree access
6. **Collaborate** → Work together on genealogy

## 🎯 Key Features in Detail

### **AI-Powered DNA Analysis**

- **Relative Matching**: Identifies potential relatives with confidence scores
- **Ancestry Estimation**: Provides detailed ethnicity breakdown
- **Genetic Insights**: Health traits, physical characteristics, heritage
- **Geographic Origins**: Maps ancestral locations

### **Interactive Family Tree**

- **Canvas Rendering**: Smooth drag-and-drop interface
- **Auto-layout**: Intelligent node positioning
- **Real-time Sync**: Live collaboration
- **Version Control**: Track changes and history
- **Export Options**: PDF, image, data export

### **Smart Search**

- **Multi-source**: Search users, family trees, historical records
- **Fuzzy Matching**: Find matches even with incomplete information
- **Context Awareness**: Consider user's existing connections
- **Privacy Respect**: Only show public information

### **Notification System**

- **Real-time**: Instant updates via Firestore listeners
- **Categorized**: Different types of notifications
- **Actionable**: Direct links to relevant actions
- **Persistent**: Mark as read/unread

## 🔧 Development

### **Project Structure**

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   └── signup/
├── components/            # React components
│   ├── dashboard/        # Dashboard-specific components
│   ├── ui/              # ShadCN UI components
│   └── family-tree/     # Family tree components
├── contexts/             # React contexts
├── hooks/               # Custom hooks
├── lib/                 # Utilities and configurations
├── types/               # TypeScript type definitions
└── ai/                  # AI integration
    ├── flows/           # Genkit flows
    └── schemas/         # AI response schemas
```

### **Key Components**

- **DashboardHeader**: Navigation, notifications, user menu
- **FamilyTreeCanvas**: Interactive tree rendering
- **DnaUploadForm**: DNA file upload and processing
- **SuggestionCard**: User discovery and connection
- **LocationSelector**: Hierarchical location selection
- **ChatAssistant**: AI chatbot interface

## 📈 Performance Optimizations

### **Search Optimization**

- **Debounced Input**: 500ms delay to reduce API calls
- **Local Caching**: 5-minute TTL for search results
- **Optimized Queries**: Range queries instead of full scans
- **Smart Limits**: Maximum 10 results per query

### **Family Tree Performance**

- **Canvas Rendering**: Efficient HTML5 canvas for large trees
- **Virtualization**: Only render visible nodes
- **Debounced Auto-save**: Prevent excessive writes
- **Lazy Loading**: Load tree data on demand

### **Real-time Updates**

- **Firestore Listeners**: Efficient real-time subscriptions
- **Selective Updates**: Only listen to relevant data
- **Connection Pooling**: Reuse database connections
- **Error Handling**: Graceful fallbacks for network issues

## 🎨 Design Principles

### **User Experience**

- **Intuitive Navigation**: Clear information architecture
- **Progressive Disclosure**: Show information as needed
- **Consistent Interactions**: Standardized UI patterns
- **Accessibility**: WCAG compliant design

### **Visual Design**

- **Heritage Theme**: Colors and fonts reflect genealogy
- **Clean Layout**: Minimal, focused interface
- **Responsive Design**: Works on all device sizes
- **Loading States**: Clear feedback for async operations

## 🔮 Future Enhancements

### **Phase 2 Features**

- **Advanced AI**: More sophisticated relationship analysis
- **Media Integration**: Photos, documents, audio recordings
- **Timeline View**: Chronological family history
- **Export Options**: GEDCOM, PDF, image formats

### **Phase 3 Features**

- **Mobile App**: Native iOS/Android applications
- **Advanced Analytics**: Family health history, migration patterns
- **Collaboration Tools**: Comments, annotations, discussions
- **Integration**: Connect with other genealogy services

## 🤝 Contributing

### **Development Setup**

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

### **Code Standards**

- **TypeScript**: Strict type checking
- **ESLint**: Code quality enforcement
- **Prettier**: Consistent formatting
- **Conventional Commits**: Clear commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@esano.com or create an issue in the repository.

---

**Esano** - Discover Your Story, Connect Your Family, Preserve Your Heritage 🌳
