export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_coach_snapshots: {
        Row: {
          biggest_mistake: string | null
          created_at: string
          focus: string | null
          id: string
          motivation: string | null
          recommendations: Json
          report_id: string | null
          revision_goal: string | null
          sync_summary: Json
          target_score: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          biggest_mistake?: string | null
          created_at?: string
          focus?: string | null
          id?: string
          motivation?: string | null
          recommendations?: Json
          report_id?: string | null
          revision_goal?: string | null
          sync_summary?: Json
          target_score?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          biggest_mistake?: string | null
          created_at?: string
          focus?: string | null
          id?: string
          motivation?: string | null
          recommendations?: Json
          report_id?: string | null
          revision_goal?: string | null
          sync_summary?: Json
          target_score?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_mock_reports: {
        Row: {
          accuracy: number | null
          created_at: string
          detected_chapter: string | null
          detected_subject: string | null
          detected_topic: string | null
          error: string | null
          exam_name: string | null
          file_paths: Json
          id: string
          ocr_text: string | null
          overall_score: number | null
          readiness_score: number | null
          report: Json | null
          report_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          detected_chapter?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          error?: string | null
          exam_name?: string | null
          file_paths?: Json
          id?: string
          ocr_text?: string | null
          overall_score?: number | null
          readiness_score?: number | null
          report?: Json | null
          report_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          detected_chapter?: string | null
          detected_subject?: string | null
          detected_topic?: string | null
          error?: string | null
          exam_name?: string | null
          file_paths?: Json
          id?: string
          ocr_text?: string | null
          overall_score?: number | null
          readiness_score?: number | null
          report?: Json | null
          report_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_release: {
        Row: {
          created_at: string
          file_path: string | null
          file_size: number | null
          id: string
          notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chapter_views: {
        Row: {
          chapter_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          chapter_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          chapter_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_views_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          name_hi: string | null
          sort_order: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_hi?: string | null
          sort_order?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_hi?: string | null
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mistake_dna: {
        Row: {
          distribution: Json
          last_attempt_id: string | null
          timeline: Json
          totals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          distribution?: Json
          last_attempt_id?: string | null
          timeline?: Json
          totals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          distribution?: Json
          last_attempt_id?: string | null
          timeline?: Json
          totals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          chapter_id: string
          content: string
          created_at: string
          id: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          content?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          content?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_progress: {
        Row: {
          id: string
          last_page: number
          pdf_id: string
          status: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_page?: number
          pdf_id: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_page?: number
          pdf_id?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdfs: {
        Row: {
          chapter_id: string | null
          created_at: string
          description: string | null
          file_path: string
          id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          id?: string
          subject_id?: string | null
          title: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdfs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdfs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      performance: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          image_path: string | null
          subject_id: string | null
          text_content: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          subject_id?: string | null
          text_content?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          subject_id?: string | null
          text_content?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option: string
          created_at: string
          explanation: string | null
          id: string
          marks: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          sort_order: number
          test_id: string
        }
        Insert: {
          correct_option: string
          created_at?: string
          explanation?: string | null
          id?: string
          marks?: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          sort_order?: number
          test_id: string
        }
        Update: {
          correct_option?: string
          created_at?: string
          explanation?: string | null
          id?: string
          marks?: number
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          sort_order?: number
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          answers: Json | null
          correct_count: number
          created_at: string
          id: string
          score: number
          test_id: string
          time_taken_seconds: number | null
          total_marks: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          test_id: string
          time_taken_seconds?: number | null
          total_marks?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          test_id?: string
          time_taken_seconds?: number | null
          total_marks?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revision_tests: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          question_count: number
          question_ids: Json
          subject_id: string | null
          test_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          question_count?: number
          question_ids?: Json
          subject_id?: string | null
          test_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          question_count?: number
          question_ids?: Json
          subject_id?: string | null
          test_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_tests_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_goals: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          description: string | null
          id: string
          report_id: string | null
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          id?: string
          report_id?: string | null
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          id?: string
          report_id?: string | null
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_goals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      study_activity: {
        Row: {
          id: string
          item_id: string
          item_type: string
          opened_at: string
          subject_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          opened_at?: string
          subject_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          opened_at?: string
          subject_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_plan_tasks: {
        Row: {
          chapter: string | null
          completed_at: string | null
          created_at: string
          day_index: number | null
          description: string | null
          estimated_minutes: number
          id: string
          practice_questions: number
          priority: string
          report_id: string | null
          revision_minutes: number
          scope: string
          status: string
          subject: string | null
          task_date: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
          week_index: number | null
        }
        Insert: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          day_index?: number | null
          description?: string | null
          estimated_minutes?: number
          id?: string
          practice_questions?: number
          priority?: string
          report_id?: string | null
          revision_minutes?: number
          scope?: string
          status?: string
          subject?: string | null
          task_date?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
          week_index?: number | null
        }
        Update: {
          chapter?: string | null
          completed_at?: string | null
          created_at?: string
          day_index?: number | null
          description?: string | null
          estimated_minutes?: number
          id?: string
          practice_questions?: number
          priority?: string
          report_id?: string | null
          revision_minutes?: number
          scope?: string
          status?: string
          subject?: string | null
          task_date?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          week_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_tasks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_pinned: boolean
          is_popular: boolean
          name: string
          name_hi: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_popular?: boolean
          name: string
          name_hi?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean
          is_popular?: boolean
          name?: string
          name_hi?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          accuracy: number
          answers: Json | null
          correct_count: number
          created_at: string
          current_index: number
          id: string
          incorrect_count: number
          marked: Json | null
          marks_obtained: number
          mode: string
          skipped_count: number
          status: string
          test_id: string
          time_taken_seconds: number
          total_questions: number
          unattempted_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          answers?: Json | null
          correct_count?: number
          created_at?: string
          current_index?: number
          id?: string
          incorrect_count?: number
          marked?: Json | null
          marks_obtained?: number
          mode?: string
          skipped_count?: number
          status?: string
          test_id: string
          time_taken_seconds?: number
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          answers?: Json | null
          correct_count?: number
          created_at?: string
          current_index?: number
          id?: string
          incorrect_count?: number
          marked?: Json | null
          marks_obtained?: number
          mode?: string
          skipped_count?: number
          status?: string
          test_id?: string
          time_taken_seconds?: number
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_mistake_analyses: {
        Row: {
          action_plan: Json
          attempt_id: string
          coach_summary: string | null
          created_at: string
          id: string
          improvements: Json
          memory_analysis: Json
          mistake_distribution: Json
          model: string | null
          overall: Json
          question_analyses: Json
          related_learning: Json
          subject_id: string | null
          test_id: string | null
          thinking_profile: Json
          time_analysis: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plan?: Json
          attempt_id: string
          coach_summary?: string | null
          created_at?: string
          id?: string
          improvements?: Json
          memory_analysis?: Json
          mistake_distribution?: Json
          model?: string | null
          overall?: Json
          question_analyses?: Json
          related_learning?: Json
          subject_id?: string | null
          test_id?: string | null
          thinking_profile?: Json
          time_analysis?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plan?: Json
          attempt_id?: string
          coach_summary?: string | null
          created_at?: string
          id?: string
          improvements?: Json
          memory_analysis?: Json
          mistake_distribution?: Json
          model?: string | null
          overall?: Json
          question_analyses?: Json
          related_learning?: Json
          subject_id?: string | null
          test_id?: string | null
          thinking_profile?: Json
          time_analysis?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_mistake_analyses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_published: boolean
          subject_id: string | null
          test_link: string | null
          test_part: string | null
          title: string
          total_marks: number | null
          total_questions: number | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          subject_id?: string | null
          test_link?: string | null
          test_part?: string | null
          title: string
          total_marks?: number | null
          total_questions?: number | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          subject_id?: string | null
          test_link?: string | null
          test_part?: string | null
          title?: string
          total_marks?: number | null
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          code: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string
          target_accuracy: number | null
          target_readiness: number | null
          target_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          target_accuracy?: number | null
          target_readiness?: number | null
          target_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          target_accuracy?: number | null
          target_readiness?: number | null
          target_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wrong_questions: {
        Row: {
          chapter_id: string | null
          consecutive_correct: number
          correct_option: string | null
          correct_revision_count: number
          created_at: string
          explanation: string | null
          id: string
          image_path: string | null
          last_attempt_at: string | null
          mastered_at: string | null
          note: string | null
          priority: string
          question_id: string | null
          question_text: string | null
          selected_option: string | null
          source: string
          source_report_id: string | null
          status: string
          subject_id: string | null
          test_id: string | null
          test_part: string | null
          topic: string | null
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          chapter_id?: string | null
          consecutive_correct?: number
          correct_option?: string | null
          correct_revision_count?: number
          created_at?: string
          explanation?: string | null
          id?: string
          image_path?: string | null
          last_attempt_at?: string | null
          mastered_at?: string | null
          note?: string | null
          priority?: string
          question_id?: string | null
          question_text?: string | null
          selected_option?: string | null
          source?: string
          source_report_id?: string | null
          status?: string
          subject_id?: string | null
          test_id?: string | null
          test_part?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          chapter_id?: string | null
          consecutive_correct?: number
          correct_option?: string | null
          correct_revision_count?: number
          created_at?: string
          explanation?: string | null
          id?: string
          image_path?: string | null
          last_attempt_at?: string | null
          mastered_at?: string | null
          note?: string | null
          priority?: string
          question_id?: string | null
          question_text?: string | null
          selected_option?: string | null
          source?: string
          source_report_id?: string | null
          status?: string
          subject_id?: string | null
          test_id?: string | null
          test_part?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wrong_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_user_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
